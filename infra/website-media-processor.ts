import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as aws from "@pulumi/aws";
import { log } from "util";

export class WebsiteMediaProcessor {

    public resource: aws.s3.Bucket;

    constructor(config: pulumi.Config) {
        this.resource = new aws.s3.Bucket(config.require("source_bucket"));

        const cluster = awsx.ecs.Cluster.getDefault();
        const bucketName = this.resource.id;

        const task = new awsx.ecs.FargateTaskDefinition("processingTask", {
            container: {
                image: awsx.ecs.Image.fromPath("processingImage", "../service"),
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
            policies: [
                aws.iam.AWSLambdaFullAccess,
                aws.iam.AmazonEC2ContainerServiceFullAccess,
            ],
            callback: async bucketArgs => {

                if (!bucketArgs.Records) {
                    return;
                }

                for (const record of bucketArgs.Records) {
                    console.log("Calling the task...");

                    const command = ["npm", "start", `s3://${bucketName.get()}/${record.s3.object.key}`];
                    console.log(command.join(" "));

                    await task
                        .run({
                            cluster,
                            overrides: {
                                containerOverrides: [
                                    {
                                        name: "container",
                                        command,
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
