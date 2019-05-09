# website

[![Build Status](https://travis-ci.org/cnunciato/website.svg?branch=master)](https://travis-ci.org/cnunciato/website)

Hey look, it's my website! 👋

Here you'll find all of the source code comprising the three main components of the project:

* In `./infra`, the [Pulumi](https://www.pulumi.com/) application that defines the [AWS](https://aws.amazon.com/) infrastructure for the website: an [S3](https://aws.amazon.com/s3/) bucket, a [CloudFront](https://aws.amazon.com/cloudfront/) distribution, and a [Fargate](https://aws.amazon.com/fargate/) service for processing inbound media submissions;

* In `./service`, the [Docker](https://www.docker.com/)ized [Express](https://expressjs.com/) app that does all the media processing, and also serves as an API service for the website; and finally,

* In `./site`, the [Hugo](https://gohugo.io/) app that compiles the static website.

Ultimately, everything ends up at https://christian.nunciato.org.
