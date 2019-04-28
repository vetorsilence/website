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

import { exiftool, ExifDateTime, Tags } from "exiftool-vendored";
import { execSync } from "child_process";

const source = process.argv[2];

if (source) {

    processFiles(source)
        .then(result => {
            console.log(result);
        })
        .catch(error => {
            console.error(error);
        });

} else {

    const port = process.env.PORT || 8080;
    const host = process.env.HOST || "0.0.0.0";
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    const repo = process.env.REPO || "cnunciato/website";
    const uploads = process.env.UPLOADS || "uploads";
    const username = process.env.USER || "cnunciato";
    const upload = multer({ dest: uploads });
    const app = express();

    app.get('/', (_req, res) => {
        res.send('Hi, world. 👋');
    });

    app.post('/', upload.any(), function (req, res, next) {
        const files = req.files as Express.Multer.File[];

        files.forEach(file => {
            const path = file.path;
            const filename = file.filename;
            const workDir = `${path}-work/media`;

            mkdirp.sync(workDir);

            // Copy and rename the file, using the extension supplied by the original.
            fs.copyFileSync(path, `${workDir}/${filename}.${file.originalname.toLowerCase().split(".").slice(-1)[0]}`);

            processFiles(workDir)
                .then(result => {
                    console.log(`👏  Yay, it worked!`);

                    const [ item ] = result;
                    const filepath = `site/content/mobile/${item.filename}.md`;

                    let [ mimeType ] = file.mimetype.split("/");
                    let frontmatter;

                    if (mimeType === "video") {
                        frontmatter = {
                            title: req.body.subject || "",
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
                            title: req.body.subject || "",
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

                    // Make it YAML.
                    const content = `---\n${yaml.stringify(frontmatter, 4)}---\n\n${req.body.text.trim() || ''}`;

                    // Send the YAML to GitHub.
                    request
                        .put(`https://api.github.com/repos/${repo}/contents/${filepath}`, {
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
                                content: Buffer.from(content).toString('base64'),
                            },

                        }, (ghErr, ghRes) => {

                            if (ghErr) {
                                console.error("💥  Error submitting to GitHub: ", ghErr);
                                res.sendStatus(500);
                                return;
                            }

                            console.log("🙌  Aww yeah:", ghRes.body);
                            res.sendStatus(200);
                        });
                })
                .catch(error => {
                    console.error("💥  Something went wrong: ", error);
                    res.sendStatus(500);
                });
        });
    });

    app.listen(port, () => {
        console.log(`🎉  The service is now running on http://${host}:${port}`);
    });
}

function processFiles(sourceDir: string): Promise<any> {
    const mediaBucket = "cnunciato-website-media";

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
                    const mediaFilename = `${filename}.${type === "video" ? "mov" : "jpg"}`;

                    console.log("⏱  Processing...");

                    const date = tagsToCreated(tags);

                    if (!date) {
                        reject(new Error(`😢  No date! The tags were: ${tags}.`));
                        return;
                    }

                    const metadata = {
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
                            gps: tags.GPSPosition,
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
                        const duration = Number(execSync(`ffprobe -i "${file}" -show_entries stream=codec_type,duration -of compact=p=0:nk=1 | head -1`).toString().trim().split("|").slice(-1)[0]);

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

                // Resolve.
                resolve(output);

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
            })
            .catch(error => {

                console.error("💥  Processing error! ", error);
                reject(error);
            })
            .finally(() => {

                // TODO: Clean up?
            });
    })
}
