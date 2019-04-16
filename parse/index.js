// Constants
const PORT = 8080;
const HOST = '0.0.0.0';
const USER = 'cnunciato';
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const REPO = 'github.com/cnunciato/website'
const UPLOADS = 'uploads';

// Set up Git
const remote = `https://${USER}:${TOKEN}@${REPO}`;

// App
const fs = require('fs');
const yaml = require('yamljs');
const execSync = require('child_process').execSync;
const express = require('express');
const multer  = require('multer');
const upload = multer({ dest: UPLOADS });
const rimraf = require("rimraf");
const request = require("request");
const slugify = require("@sindresorhus/slugify");
const app = express();

rimraf.sync(UPLOADS);
fs.mkdirSync(UPLOADS);

app.get('/', (req, res) => {
  res.send('Hi, world. 👋');
});

app.post('/', upload.any(), function (req, res, next) {

    // TODO: Should probably validate this is from a particular address, or something.
    // Just so it isn't wide upen to the world.

    // TODO: Weird things happen when we export from Lightroom on the iPhone -- it appears
    // to strip out all the useful EXIF data, and the dates get weird, too. So we should
    // probably support some kind of a way to share a Lightroom share URL or something, but
    // it's not pressing right now.

    // Much cooler would be to support video clips. NEXT!

    console.log("req.body:", req.body);
    console.log("req.files:", req.files);

    req.files.forEach(file => {

        // TODO: Handle more than just JPGs! No reason not to.
        // And what about multiple attachments? That should/could work too, no?

        if (file.mimetype === "image/jpeg") {
            const path = file.path;
            const name = file.filename;

            // Make a folder to contain the new file, so we can process it.
            fs.mkdirSync(name);

            // Make a media folder under that.
            fs.mkdirSync(`${name}/media`);

            // Copy the file to the media folder, renaming it at the same time.
            // TODO: You'll need to update this extension here.
            fs.copyFileSync(path, `${name}/media/${name}.jpg`);

            // Clone the website repo, which gives us access to the processing scripts.
            execSync(`git clone ${remote} ${name}/website`, { stdio: "inherit" });

            // TODO: Rather than clone the whole repo, just use the `contents` API to download and save it, then
            // remove the dependency on git.
            // https://developer.github.com/v3/repos/contents/#get-contents

            // Process the file, by processing all files in the media directory. Send the output to a file.
            execSync(`${name}/website/process/process.sh ${name}/media | tee ${name}/out.yaml`, { stdio: "inherit" });

            // TODO: All bets are off if the push to S3 failed. Exit loudly here and do not push to GitHub.
            // Note that this may be something we need to do in the script itself.

            // Read the output into a string.
            const output = fs.readFileSync(`${name}/out.yaml`, 'utf-8');

            if (!output || output === "") {
                console.error("No output!");
                return;
            }

            // Take the output from that process and turn it into a JSON object,
            // so we can manipulate it before posting to GitHub as YAML.
            const result = yaml.parse(output.substr(output.indexOf("- type: photo")));
            const photo = result[0];

            // Make a new post, using the subject line of the email.
            const filepath = `site/content/mobile/${slugify(req.body.subject || "Untitled")}-${new Date(photo.created).getTime() / 1000}.md`;

            // Update the frontmatter.
            const frontmatter = {
                title: req.body.subject || "Untitled",
                date: photo.created,
                draft: false,
                photo: {
                    url: photo.url,
                    thumb: photo.thumb,
                    preview: photo.preview,
                    created: photo.created,
                    exif: photo.exif,
                    title: photo.title,
                    caption: photo.caption,
                }
            };

            // Now turn the JSON back into YAML, for consumption by Hugo.
            const contents = `---\n${yaml.stringify(frontmatter, 4)}---\n\n${req.body.text.trim() || ''}`;

            // Post a new file to GitHub with that YAML.
            request.put(`https://api.github.com/repos/cnunciato/website/contents/${filepath}`, {
                headers: {
                    "User-Agent": "Christian's Parser-Uploader"
                },
                auth: {
                    username: "cnunciato",
                    password: TOKEN,
                },
                json: {
                    message: "Add a photo",
                    committer: {
                        name: "Christian Nunciato",
                        email: "c@nunciato.org",
                    },
                    content: Buffer.from(contents).toString('base64'),
                },
            }, (err, res) => {
                if (err) {
                    console.err("Error putting the file to GitHub:", err);
                }
                console.log("Response:", res);
            });
        }
    });

    res.sendStatus(200);
})

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
