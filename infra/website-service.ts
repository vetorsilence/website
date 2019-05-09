import * as pulumi from "@pulumi/pulumi";
import * as cloud from "@pulumi/cloud";

export class WebsiteService {

    public resource: cloud.Service;

    constructor(config: pulumi.Config, ) {

        // Define the service application, which receives HTTP posts and creates new website content from them.
        this.resource = new cloud.Service("service", {
                containers: {
                        service: {
                                image: config.require("service_image"),
                                memory: 4096,
                                cpu: 4,
                                ports: [
                                        {
                                                port: 80,
                                                targetPort: 8080,
                                        }
                                ],
                                environment: {
                                        AWS_ACCESS_KEY_ID: config.require("aws_access_key_id"),
                                        AWS_SECRET_ACCESS_KEY: config.require("aws_secret_access_key"),
                                        GITHUB_PERSONAL_ACCESS_TOKEN: config.require("github_personal_access_token"),
                                },
                        },
                },
                replicas: 1,
        });
    }
}
