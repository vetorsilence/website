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
        thumb?: string;
        preview?: string;
        poster?: string;
        created: Date;
        exif?: Exif;
        title?: string;
        caption?: string;
        controls: boolean;
        duration?: number;
    };
    photo?: {
        url: string;
        thumb?: string;
        preview?: string;
        created: Date;
        exif?: Exif;
        title?: string;
        caption?: string;
    };
    sound?: {
        url: string;
        photo?: string;
        thumb?: string;
        preview?: string;
        duration?: number;
    };
}

interface MovieFrontmatter {
    title: string;
    date: Date;
    draft: boolean;
    rating: number;
    description: string;
    director: string | null;
    year: number | null;
    links: { name: string, url: string}[];
}

interface ProcessingResult {
    type: "photo" | "video" | "sound";
    title: string | undefined;
    caption: string | undefined;
    created: Date;
    url: string;
    filename: string | undefined;
    preview?: string;
    thumb?: string;
    poster?: string;
    duration?: number;
    exif?: Exif;
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

interface GitHubSubmission {
    frontmatter: MobileFrontmatter;
    content: string;
    path: string;
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

        // https://sendgrid.com/docs/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
        const [ toAddress ] = req.body.envelope.to;
        const messageSubject = req.body.subject;
        const messageBody = req.body.text;

        // Thanks -- we'll get to it.
        res.sendStatus(202);

        // Handle the type of submission.
        console.log(`🏈 Receiving...`, toAddress, messageSubject, messageBody);
        console.log(toJson(req.body));

        // Don't handle anything sent to stuff.
        if (!!toAddress.match(/stuff/)) {
            // res.sendStatus(200);
            return;
        }

        // Submit a movie.
        if (toAddress.match(/movies@/)) {
            const contentFilePath = `site/content/movies/${slugify(messageSubject)}.md`;
            const rating = parseInt(messageBody);

            const frontmatter: MovieFrontmatter = {
                title: messageSubject,
                date: new Date(),
                draft: false,
                rating,
                director: null,
                year: null,
                description: "",
                links: [],
            };

            // Submit the movie to GitHub.
            submitToGitHub(contentFilePath, frontmatter, messageBody.replace(rating, "").trim())
                .then(response => {
                    // res.sendStatus(204);
                })
                .catch(err => {
                    console.error("💥 submitToGitHub error in movie submission: ", contentFilePath, frontmatter, messageBody);
                    console.log  ("Sending a 500.")
                    // res.sendStatus(500);
                });

            return;
        }

        // Otherwise, if there are attachments, submit a mobile item.
        if (req.files && req.files.length > 0) {
            const files = req.files as Express.Multer.File[];
            const title = messageSubject || "";
            const useGPS = toAddress.match(/^gps@/);

            const filesToProcess = files.map(uploadedFile => {
                console.log("UploadedFile: ", uploadedFile);

                return new Promise<GitHubSubmission | null>((resolve, reject) => {
                    const uploadedFilePath = uploadedFile.path;
                    const uploadedFileName = uploadedFile.filename;
                    const workDir = `${uploadedFilePath}-work/media`;

                    mkdirp.sync(workDir);

                    // Copy and rename the file, using the extension supplied by the original.
                    const newFilename = `${workDir}/${uploadedFileName}${path.extname(uploadedFile.originalname)}`;
                    fs.copyFileSync(uploadedFilePath, newFilename);

                    processFiles(workDir, useGPS)
                        .then(result => {
                            const [ item ] = result;

                            // Unprocessed items will be returned as empty arrays.
                            if (!item) {
                                resolve(null);
                                return;
                            }

                            const contentFilePath = `site/content/mobile/${item.filename}.md`;
                            const fileType = fileToItemType(`${newFilename}`);

                            if (!fileType) {
                                reject(new Error(`💥 Unable to determine mimeType for ${uploadedFilePath}.`));
                                return;
                            }

                            let frontmatter: MobileFrontmatter | undefined;

                            if (fileType === "video") {
                                frontmatter = {
                                    title,
                                    date: item.created,
                                    draft: false,
                                    video: {
                                        url: item.url,
                                        thumb: item.thumb,
                                        preview: item.preview,
                                        poster: item.poster,
                                        created: item.created,
                                        exif: item.exif,
                                        title: item.title,
                                        caption: item.caption,
                                        controls: true,
                                        duration: item.duration,
                                    },
                                };
                            }

                            if (fileType === "photo") {
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

                            if (fileType === "sound") {
                                frontmatter = {
                                    title,
                                    date: item.created,
                                    draft: false,
                                    sound: {
                                        url: item.url,
                                        thumb: item.thumb,
                                        preview: item.preview,
                                        duration: item.duration,
                                    }
                                }
                            }

                            if (!frontmatter) {
                                reject(new Error(`💥 No frontmatter! The result was ${toJson(result)}.`));
                                return;
                            }

                            resolve({
                                frontmatter,
                                content: messageBody,
                                path: contentFilePath,
                            });
                        })
                        .catch(error => {
                            reject(new Error(`💥 Something went wrong: ${error}`));
                        })
                        .finally(() => {

                            // Clean up
                            console.log(`✨ Cleaning up ${uploadedFilePath}...`);
                            rimraf.sync(`${uploadedFilePath}*`);
                        });
                });
            });

            Promise
                .all(filesToProcess)
                .then(results => {
                    console.log("Process.all handler: ", results);

                    let selection: GitHubSubmission | undefined;

                    // Filter out the nulls.
                    const submissions = results.filter(r => r !== null);

                    // When multiple items have been submitted, chances are it's a sound with an (optional) image.
                    // Look for a sound, treat that as the main thing to be submitted, and then treat the accompanying
                    // image as its... well, accompaniment.

                    const submittableSound = submissions.filter(s => s && !!s.frontmatter.sound)[0];
                    const submittablePhoto = submissions.filter(s => s && !!s.frontmatter.photo)[0];
                    const submittableVideo = submissions.filter(s => s && !!s.frontmatter.video)[0];

                    if (submittableSound) {
                        selection = submittableSound;

                        if (submittablePhoto && selection.frontmatter.sound && submittablePhoto.frontmatter.photo) {
                            selection.frontmatter.sound.photo = submittablePhoto.frontmatter.photo.url;
                            selection.frontmatter.sound.preview = submittablePhoto.frontmatter.photo.preview;
                            selection.frontmatter.sound.thumb = submittablePhoto.frontmatter.photo.thumb;
                        }
                    } else if (submittablePhoto) {
                        selection = submittablePhoto;
                    }
                    else if (submittableVideo) {
                        selection = submittableVideo;
                    }

                    if (!selection) {
                        console.error("💥 Selection not set. We have: ", submittableSound, submittablePhoto, submittableVideo);
                        console.log  ("Sending a 500.")
                        // res.sendStatus(500);
                        return;
                    }

                    // Submit the item to GitHub.
                    submitToGitHub(selection.path, selection.frontmatter, selection.content)
                        .then(response => {
                            // res.sendStatus(204);
                        })
                        .catch(error => {
                            console.error("💥 submitToGitHub error: ", error);
                            console.log  ("Sending a 500.")
                            // res.sendStatus(500);
                        });
                })
                .catch(error => {
                    console.error("💥 Error in Process.all handler: ", error);
                    console.log  ("Sending a 500.")
                    // res.sendStatus(500);
                })
                .finally(() => {
                    console.log("Finished.");
                });
        }
    });

    app.listen(port, () => {
        console.log(`🎉 The service is now running on http://${host}:${port}`);
    });
}

function submitToGitHub(
        contentFilePath: string,
        frontmatter: MobileFrontmatter | MovieFrontmatter,
        content: string = ""): Promise<any> {

    const username = process.env.USER || "cnunciato";
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    const repo = process.env.REPO || "cnunciato/website";

    console.log(`➡️ Sending to GitHub: ${contentFilePath}, ${toJson(frontmatter)}, ${content}...`);

    return new Promise((resolve, reject) => {

        // Convert frontmatter to YAML and append content, if any.
        const yamlContent = `---\n${toYaml(frontmatter)}---\n\n${content.trim()}`;

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
                    console.error("💥 Error submitting to GitHub: ", ghErr);
                    reject(ghErr);
                    return;
                }

                console.log("🙌  Aww yeah:", ghRes.body);
                resolve(ghRes);
            });
    });
}

function processFiles(sourceDir: string, useGPS: boolean): Promise<(ProcessingResult | null)[]> {
    const processed = `${sourceDir}/Out`;
    const mediaPath = `${processed}/media`
    const imagesPath = `${mediaPath}/images`;
    const videoPath = `${mediaPath}/video`;
    const audioPath = `${mediaPath}/audio`;
    const thumbPath = `${mediaPath}/thumbs`;
    const previewPath = `${mediaPath}/previews`;
    const posterPath = `${mediaPath}/posters`;

    const thumbWidth = 320;
    const previewWidth = 800;
    const largeWidth = 1600;

    const output: ProcessingResult[] = [];

    rimraf.sync(processed);
    mkdirp.sync(processed);
    mkdirp.sync(mediaPath);
    mkdirp.sync(imagesPath);
    mkdirp.sync(videoPath);
    mkdirp.sync(audioPath);
    mkdirp.sync(thumbPath);
    mkdirp.sync(previewPath);
    mkdirp.sync(posterPath);

    const files = glob.sync(`${sourceDir}/**/*.*`);

    return new Promise<ProcessingResult[]>((resolve, reject) => {
        return Promise
            .all(files.map(file => exiftool.read(file)))
            .then(results => {

                for (let i = 0; i < results.length; i++) {
                    const file = files[i];
                    const tags = results[i];
                    const filename = tagsToFilename(results[i]);
                    const type = fileToItemType(file);

                    if (!type) {
                        console.error(`🤔 Couldn't find a submission type for ${file}. Skipping.`);
                        continue;
                    }

                    let extension;
                    let s3Path;

                    if (type === "photo") {
                        extension = "jpg";
                        s3Path = "images";
                    } else if (type === "video") {
                        extension = "mp4";
                        s3Path = "video";
                    } else if (type === "sound") {
                        extension = "m4a";
                        s3Path = "audio";
                    }

                    if (!extension) {
                        console.log("Tags:", tags);
                        reject(new Error("😢 No file extension detected! See above for the tags."));
                        return;
                    }

                    const mediaFilename = `${filename}.${extension}`;

                    console.log("⏱ Processing...");

                    const date = tagsToCreated(tags);

                    if (!date) {
                        console.log("Tags:", tags);
                        reject(new Error("😢 No date detected! See above for the tags."));
                        return;
                    }

                    const metadata: ProcessingResult = {
                        type: type,
                        title: tags.Title,
                        caption: tags.Description,
                        created: moment.tz(date.toDate(), "America/Los_Angeles").toDate(),
                        url: `s3/${s3Path}/${mediaFilename}`,
                        filename,
                    }

                    if (type === "photo" || type === "video") {
                        Object.assign(metadata, {
                            preview: `s3/previews/${filename}.jpg`,
                            thumb: `s3/thumbs/${filename}.jpg`,
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
                        });
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
                        const duration = getMediaDuration(file);

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
                            poster: `s3/posters/${filename}.jpg`,
                        });
                    }

                    if (type === "sound") {

                        // Duration
                        const duration = getMediaDuration(file);

                        // Just copy the file, verbatim. (At least as of today; maybe someday, we'll also do fades here, too.)
                        fs.copyFileSync(file, `${audioPath}/${mediaFilename}`);

                        Object.assign(metadata, {
                            duration,
                        });
                    }

                    output.push(metadata);
                }
            })
            .then(() => {
                console.log("\n---------------------------------------------------------------------------------\n");

                // Write the output files.
                console.log(`📝 Writing ${processed}/out.json ...`);
                fs.writeFileSync(`${processed}/out.json`, JSON.stringify(output, null, 4));

                console.log(`📝 Writing ${processed}/out.yaml ...`);
                fs.writeFileSync(`${processed}/out.yaml`, toYaml(output));

                // Upload to S3.
                console.log(`⬆️ Uploading ${output.length} objects to S3...`);
                execSync(`aws s3 sync ${mediaPath} s3://${mediaBucket}`);

                console.log(`📸 ${output.length} objects processed.`);
                console.log("🍻 Done.")

                console.log(`👏 Yay, it worked!`);
                resolve(output);
            })
            .catch(error => {

                console.error("💥 Processing error! ", error);
                reject(error);
            });
    })
}

function getMediaDuration(path: string): number {
    return parseInt(execSync(`ffprobe -i "${path}" -show_entries stream=codec_type,duration -of compact=p=0:nk=1 | head -1`).toString().trim().split("|").slice(-1)[0]);
}

function tagsToCreated(tags: Tags): ExifDateTime | undefined {
    console.log("Tags: ", tags);

    // Note that CreationDate is present with iOS videos, but is apparently not a known type to exiftool-vendored.
    return (tags.DateTimeCreated || tags.DateCreated || tags.DateTimeOriginal || tags["CreationDate"]) as ExifDateTime;
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

function fileToItemType(path: string): "photo" | "video" | "sound" | undefined {
    const mimeType = mime.getType(path);
    console.log(path);

    if (mimeType) {
        const [ type ] = mimeType.split("/");

        switch (type) {
            case "image":
                return "photo";
            case "video":
                return "video";
            case "audio":
            case "application":
                return "sound";
        }
    }

    return undefined;
}

function toYaml(json: any, inline = 4, indent = 2): string {
    return yaml.stringify(json, inline, indent);
}

function toJson(obj: any): string {
    return JSON.stringify(obj, null, 4);
}
