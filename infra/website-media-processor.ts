import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";
import { log } from "util";

export class WebsiteMediaProcessor {

    public resource: aws.s3.Bucket;

    constructor(config: pulumi.Config) {

        // A simple cluster to run our tasks in.
        const cluster = awsx.ecs.Cluster.getDefault();

        // A bucket to store videos and thumbnails.
        this.resource = new aws.s3.Bucket(config.require("source_bucket"));

        // The name of the bucket.
        const bucketName = this.resource.id;

        // A task which runs a containerized FFMPEG job to extract a thumbnail image.
        const task = new awsx.ecs.FargateTaskDefinition("processingTask", {
            container: {
                image: config.require("service_image"),
                memory: 4096,
                cpu: 4,
                environment: [
                    {
                        name: "AWS_ACCESS_KEY_ID",
                        value: config.require("aws_access_key_id"),
                    },
                    {
                        name: "AWS_SECRET_ACCESS_KEY",
                        value: config.require("aws_secret_access_key"),
                    },
                    {
                        name: "GITHUB_PERSONAL_ACCESS_TOKEN",
                        value: config.require("github_personal_access_token"),
                    }
                ]
            },
        });

        const cb =  new aws.lambda.CallbackFunction<aws.s3.BucketEvent, void>("onObjectCreated", {

            // Specify appropriate policies so that this AWS lambda can run EC2 tasks.
            policies: [
                aws.iam.AWSLambdaFullAccess,                 // Provides wide access to "serverless" services (Dynamo, S3, etc.)
                aws.iam.AmazonEC2ContainerServiceFullAccess, // Required for lambda compute to be able to run Tasks
            ],
            callback: async bucketArgs => {
                console.log(bucketArgs);

                if (!bucketArgs.Records) {
                    console.log("No bucket arguments provided. Bailing.");
                    return;
                }

                for (const record of bucketArgs.Records) {
                    console.log(JSON.stringify(record.s3.object, null, 4));

                    await task.run({
                        cluster,
                        overrides: {
                            containerOverrides: [
                                {
                                    name: "container",
                                    environment: [
                                        {
                                            name: "S3_URL",
                                            value: `s3://${bucketName}/${record.s3.object.key}`,
                                        }
                                    ]
                                }
                            ]
                        }
                    });
                }
            }
        });

        this.resource.onObjectCreated("onObjectCreated", cb);
    }
}
