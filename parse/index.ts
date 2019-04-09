import * as cloud from "@pulumi/cloud";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

let service = new cloud.Service("parse", {
    containers: {
        parse: {
            build: "./app",
            memory: 2048,
            cpu: 2,
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

// export just the hostname property of the container frontend
exports.url = service.defaultEndpoint.apply(e => `http://${e.hostname}`);
