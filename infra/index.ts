import * as pulumi from "@pulumi/pulumi";

import { Website } from "./website";
// import { WebsiteService } from "./website-service";
import { WebsiteMediaProcessor } from "./website-media-processor";

// Stack configuration.
const config = new pulumi.Config("website");

// Cloud resources.
const site = new Website(config)
// const service = new WebsiteService(config);
const processor = new WebsiteMediaProcessor(config);

// Stack outputs.
export const bucketName = site.bucket.resource.bucketDomainName;
export const bucketURL = site.bucket.resource.websiteEndpoint;
export const distributionID = site.distribution.resource.id;
export const distributionURL = site.distribution.resource.domainName;
export const sourceBucketName = processor.resource.bucket;
// export const serviceEndpoint = service.resource.defaultEndpoint.apply(e => `http://${e.hostname}`);
