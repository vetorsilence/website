import * as glob from "glob";
import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";
import * as path from "path";
import * as mime from "mime";
import * as moment from "moment-timezone";
import * as yaml from "yamljs";
import * as fs from "fs";
import * as express from "express";
import * as multer  from "multer";
import * as request from "request";
import * as slugify from "@sindresorhus/slugify";

import { exiftool, ExifDateTime, Tags } from "exiftool-vendored";
import { execSync } from "child_process";

const source = process.argv[2];

interface MobileFrontmatter {
    title: string;
    date: Date;
    draft: boolean;
    video?: {
        url: string;
        thumb: string;
        preview: string;
        created: Date;
        exif: Exif;
        title: string;
        caption: string;
        controls: boolean;
        duration: number;
        poster: string;
    };
    photo?: {
        url: string;
        thumb: string;
        preview: string;
        created: Date;
        exif: Exif;
        title: string;
        caption: string;
    };
    sound?: {
        url: string;
        thumb: string;
        preview: string;
        duration: number;
    };
}

interface MovieFrontmatter {
    title: string;
    date: Date;
    draft: boolean;
    rating: number;
    description: string;
    director: string
    year: number
    links: { name: string, url: string}[];
}

interface ProcessingResult {
    type: "photo" | "video";
    title: string | undefined;
    caption: string | undefined;
    created: Date;
    url: string;
    preview: string;
    thumb: string;
    filename: string | undefined;
    exif: Exif;
}

interface Exif {
    make: string | undefined,
    model: string | undefined,
    lens: string | undefined,
    iso: number | undefined,
    aperture: number | undefined,
    shutter_speed: string | undefined,
    focal_length: string | undefined,
    gps: string | undefined,
}

const mediaBucket = "cnunciato-website-media";

if (source) {

    processFiles(source, true)
        .then(result => {
            console.log(result);
        })
        .catch(error => {
            console.error(error);
        })
        .finally(() => {
            exiftool.end();
        });

} else {

    const port = process.env.PORT || 8080;
    const host = process.env.HOST || "0.0.0.0";
    const uploads = process.env.UPLOADS || "uploads";
    const upload = multer({ dest: uploads });
    const app = express();

    app.get('/', (_req, res) => {
        res.send('Hi, world. 👋');
    });

    app.post('/', upload.any(), function (req, res, next) {
        const toAddress = req.body.to;
        const messageSubject = req.body.subject;
        const messageBody = req.body.text;

        // Handle the type of submission.
        console.log(`🏈  Receiving...`, toAddress, messageSubject, messageBody);

        // Submit a movie.
        if (toAddress.match(/movies@/)) {
            const contentFilePath = `site/content/movies/${slugify(messageSubject)}.md`;

            const frontmatter: MovieFrontmatter = {
                title: messageSubject,
                date: new Date(),
                draft: false,
                rating: parseInt(messageBody),
                director: "",
                year: new Date().getFullYear(),
                description: "",
                links: [],
            };

            // Submit the movie to GitHub.
            submitToGitHub(contentFilePath, frontmatter, messageBody)
                .then(response => {
                    res.sendStatus(204);
                })
                .catch(err => {
                    res.sendStatus(500);
                });

            return;
        }

        // Submit a sound.
        if (toAddress.match(/sounds@/) && req.files && req.files.length > 0) {

            const files = req.files as Express.Multer.File[];
            const title = messageSubject || "";

            files.forEach(uploadedFile => {
                const uploadedFilePath = uploadedFile.path;
                const workDir = `${uploadedFilePath}-work/media`;
                const audioPath = `${workDir}/audio`;

                mkdirp.sync(audioPath);

                // Basename is currently based on now, but could also be driven by EXIF data, since we'll have it,
                // and will want to use it for duration, too.
                const basename = moment().format("YYYY-MM-DD-HH-mm-ss");

                // Copy and rename the file, using the extension supplied by the original.
                const audioFilename = `${basename}.${uploadedFile.originalname.toLowerCase().split(".").slice(-1)[0]}`;
                const contentFilePath = `site/content/mobile/${basename}.md`;

                fs.copyFileSync(uploadedFilePath, `${audioPath}/${audioFilename}`);

                const frontmatter: MobileFrontmatter = {
                    title,
                    date: new Date(),
                    draft: false,
                    sound: {
                        url: `s3/audio/${audioFilename}`,

                        // TODO: These.
                        preview: 's3/previews/wrong.jpg',
                        thumb: 's3/thumbs/wrong.jpg',
                        duration: 0,
                    },
                };

                // Upload to S3.
                console.log(`⬆️  Uploading object to S3...`);
                execSync(`aws s3 sync ${workDir} s3://${mediaBucket}`);

                // Submit the sound to GitHub.
                submitToGitHub(contentFilePath, frontmatter, messageBody)
                    .then(response => {
                        res.sendStatus(204);
                    })
                    .catch(err => {
                        res.sendStatus(500);
                    });

                // Clean up
                console.log(`✨  Cleaning up ${uploadedFilePath} & ${workDir}...`);
                rimraf.sync(uploadedFilePath);
                rimraf.sync(workDir);
            });

            return;
        }

        // Otheriwe, if there are attachments, submit a mobile item.
        if (req.files && req.files.length > 0) {
            const files = req.files as Express.Multer.File[];
            const title = messageSubject || "";
            const useGPS = toAddress.match(/gps@/);

            files.forEach(uploadedFile => {
                const uploadedFilePath = uploadedFile.path;
                const uploadedFileName = uploadedFile.filename;
                const workDir = `${uploadedFilePath}-work/media`;

                mkdirp.sync(workDir);

                // Copy and rename the file, using the extension supplied by the original.
                fs.copyFileSync(uploadedFilePath, `${workDir}/${uploadedFileName}.${uploadedFile.originalname.toLowerCase().split(".").slice(-1)[0]}`);

                processFiles(workDir, useGPS)
                    .then(result => {
                        console.log(`👏  Yay, it worked!`);

                        const [ item ] = result;
                        const contentFilePath = `site/content/mobile/${item.filename}.md`;

                        let [ mimeType ] = uploadedFile.mimetype.split("/");
                        if (!mimeType) {
                            console.error(`💥  Unable to determine mimeType for ${uploadedFile}.`);
                            return;
                        }

                        let frontmatter: MobileFrontmatter | undefined;

                        if (mimeType === "video") {
                            frontmatter = {
                                title,
                                date: item.created,
                                draft: false,
                                video: {
                                    url: item.url,
                                    thumb: item.thumb,
                                    preview: item.preview,
                                    created: item.created,
                                    exif: item.exif,
                                    title: item.title,
                                    caption: item.caption,
                                    controls: item.controls,
                                    duration: item.duration,
                                    poster: item.poster,
                                },
                            };
                        }

                        if (mimeType === "image") {
                            frontmatter = {
                                title,
                                date: item.created,
                                draft: false,
                                photo: {
                                    url: item.url,
                                    thumb: item.thumb,
                                    preview: item.preview,
                                    created: item.created,
                                    exif: item.exif,
                                    title: item.title,
                                    caption: item.caption,
                                }
                            };
                        }

                        if (!frontmatter) {
                            console.error(`💥  No frontmatter! The result was ${result}.`);
                            res.sendStatus(500);
                            return;
                        }

                        // Submit the item to GitHub.
                        submitToGitHub(contentFilePath, frontmatter, messageBody)
                            .then(response => {
                                res.sendStatus(204);
                            })
                            .catch(err => {
                                res.sendStatus(500);
                            });
                    })
                    .catch(error => {
                        console.error("💥  Something went wrong: ", error);
                        res.sendStatus(500);
                    })
                    .finally(() => {

                        // Clean up
                        console.log(`✨  Cleaning up ${uploadedFilePath} & ${workDir}...`);
                        rimraf.sync(uploadedFilePath);
                        rimraf.sync(workDir);
                    });
            });

            return;
        }
    });

    app.listen(port, () => {
        console.log(`🎉  The service is now running on http://${host}:${port}`);
    });
}

function submitToGitHub(
        contentFilePath: string,
        frontmatter: MobileFrontmatter | MovieFrontmatter,
        content: string = ""): Promise<any> {

    const username = process.env.USER || "cnunciato";
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    const repo = process.env.REPO || "cnunciato/website";

    console.log(`➡️  Sending to GitHub: ${contentFilePath}, ${JSON.stringify(frontmatter, null, 2)}, ${content}...`);

    return new Promise((resolve, reject) => {

        // Convert frontmatter to YAML and append content, if any.
        const yamlContent = `---\n${yaml.stringify(frontmatter, 4)}---\n\n${content.trim()}`;

        // Send it all to GitHub.
        request
            .put(`https://api.github.com/repos/${repo}/contents/${contentFilePath}`, {
                headers: {
                    "User-Agent": "Christian's Parser-Uploader"
                },
                auth: {
                    username,
                    password: token,
                },
                json: {
                    message: "Add a mobile item",
                    committer: {
                        name: "Christian Nunciato",
                        email: "c@nunciato.org",
                    },
                    content: Buffer.from(yamlContent).toString('base64'),
                },

            }, (ghErr, ghRes) => {

                if (ghErr) {
                    console.error("💥  Error submitting to GitHub: ", ghErr);
                    reject(ghErr);
                    return;
                }

                console.log("🙌  Aww yeah:", ghRes.body);
                resolve(ghRes);
            });
    });
}

function processFiles(sourceDir: string, useGPS: boolean): Promise<any> {
    const processed = `${sourceDir}/Out`;
    const mediaPath = `${processed}/media`
    const imagesPath = `${mediaPath}/images`;
    const videoPath = `${mediaPath}/video`;
    const thumbPath = `${mediaPath}/thumbs`;
    const previewPath = `${mediaPath}/previews`;
    const posterPath = `${mediaPath}/posters`;

    const thumbWidth = 320;
    const previewWidth = 800;
    const largeWidth = 1600;

    const output: any[] = [];

    rimraf.sync(processed);
    mkdirp.sync(processed);
    mkdirp.sync(mediaPath);
    mkdirp.sync(imagesPath);
    mkdirp.sync(videoPath);
    mkdirp.sync(thumbPath);
    mkdirp.sync(previewPath);
    mkdirp.sync(posterPath);

    const files = glob.sync(`${sourceDir}/**/*.*`);

    function tagsToCreated(tags: Tags): ExifDateTime | undefined {
        console.log("Tags: ", tags);
        return (tags.DateTimeCreated || tags.DateCreated || tags["CreationDate"] || tags.CreateDate) as ExifDateTime;
    }

    function tagsToFilename(tags: Tags): string | undefined {
        const created = tagsToCreated(tags);

        if (!created || !created.rawValue) {
            return undefined;
        }

        return [
            created.year,
            created.month,
            created.day,
            created.hour,
            created.minute,
            created.second,
        ]
        .map(n => n.toString().length < 4 ? `0${n}`.slice(-2) : n)
        .join("-");
    }

    function fileToType(path: string): "photo" | "video" | undefined {
        const mimeType = mime.getType(path);

        if (mimeType) {
            const [ type ] = mimeType.split("/");

            switch (type) {
                case "image":
                    return "photo";
                case "video":
                    return "video";
            }
        }

        return undefined;
    }

    return new Promise((resolve, reject) => {

        Promise
            .all(files.map(file => exiftool.read(file)))
            .then(results => {

                for (let i = 0; i < results.length; i++) {
                    const file = files[i];
                    const tags = results[i];
                    const filename = tagsToFilename(results[i]);
                    const type = fileToType(file);

                    if (!type) {
                        console.error(`💥  Couldn't determine type for ${file}.`);
                        return;
                    }

                    const mediaFilename = `${filename}.${type === "video" ? "mov" : "jpg"}`;

                    console.log("⏱  Processing...");

                    const date = tagsToCreated(tags);

                    if (!date) {
                        reject(new Error(`😢  No date! The tags were: ${tags}.`));
                        return;
                    }

                    const metadata: ProcessingResult = {
                        type: type,
                        title: tags.Title,
                        caption: tags.Description,
                        created: moment.tz(date.toDate(), "America/Los_Angeles").toDate(),
                        url: `s3/${type === "video" ? "video" : "images"}/${mediaFilename}`,
                        preview: `s3/previews/${filename}.jpg`,
                        thumb: `s3/thumbs/${filename}.jpg`,
                        filename,
                        exif: {
                            make: tags.Make,
                            model: tags.Model,
                            lens: tags.LensModel,
                            iso: tags.ISO,
                            aperture: tags.ApertureValue,
                            shutter_speed: tags.ShutterSpeed,
                            focal_length: tags.FocalLength,
                            gps: useGPS ? tags.GPSPosition : undefined,
                        },
                    }

                    if (type === "photo") {

                        execSync(`exiftran -a -i ${file}`);

                        // Large
                        execSync(`ffmpeg -i "${file}" -vf "scale=${largeWidth}:-1" -pix_fmt yuvj422p -q:v 4 -y "${imagesPath}/${mediaFilename}"`);

                        // Preview
                        execSync(`ffmpeg -i "${file}" -vf "scale=${previewWidth}:-1" -pix_fmt yuvj422p -q:v 4 -y "${previewPath}/${mediaFilename}"`);

                        // Thumb
                        execSync(`ffmpeg -i "${file}" -vf "scale=${thumbWidth}:-1" -pix_fmt yuvj422p -q:v 1 -y "${thumbPath}/${mediaFilename}"`);
                    }

                    if (type === "video") {

                        // Duration
                        const duration = parseInt(execSync(`ffprobe -i "${file}" -show_entries stream=codec_type,duration -of compact=p=0:nk=1 | head -1`).toString().trim().split("|").slice(-1)[0]);

                        // Large
                        execSync(`ffmpeg -i "${file}" -vf "fade=in:0:30,fade=out:st=${duration - 1}:d=1,scale=${largeWidth}:-1" -af "afade=in:st=0:d=1,afade=out:st=${duration - 1}:d=1" -vcodec h264 -acodec aac -strict -2 "${videoPath}/${mediaFilename}"`);

                        // Preview
                        execSync(`ffmpeg -i "${file}" -vf "select=gte(n\\,100),scale=${previewWidth}:-1" -vframes 1 "${previewPath}/${filename}.jpg"`);

                        // Thumb
                        execSync(`ffmpeg -i "${file}" -vf "select=gte(n\\,100),scale=${thumbWidth}:-1" -vframes 1 "${thumbPath}/${filename}.jpg"`);

                        // Poster
                        execSync(`ffmpeg -i "${file}" -vf "select=gte(n\\,100),scale=${largeWidth}:-1" -vframes 1 "${posterPath}/${filename}.jpg"`);

                        Object.assign(metadata, {
                            duration,
                            controls: true,
                            poster: `s3/posters/${filename}.jpg`,
                        });
                    }

                    output.push(metadata);
                }
            })
            .then(() => {
                console.log("\n---------------------------------------------------------------------------------\n");

                // Write the output files.
                console.log(`📝  Writing ${processed}/out.json ...`);
                const json = JSON.stringify(output, null, 4);
                fs.writeFileSync(`${processed}/out.json`, json);

                console.log(`📝  Writing ${processed}/out.yaml ...`);
                fs.writeFileSync(`${processed}/out.yaml`, yaml.stringify(json));

                // Upload to S3.
                console.log(`⬆️  Uploading ${output.length} objects to S3...`);
                execSync(`aws s3 sync ${mediaPath} s3://${mediaBucket}`);

                console.log(`📸  ${output.length} objects processed.`);
                console.log("🍻  Done.")
                resolve(output);
            })
            .catch(error => {

                console.error("💥  Processing error! ", error);
                reject(error);
            });
    })
}
