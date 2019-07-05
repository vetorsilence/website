import * as pulumi from "@pulumi/pulumi";

import { Website } from "./website";
import { WebsiteMediaProcessor } from "./website-media-processor";

// Stack configuration.
const config = new pulumi.Config("website");

// Cloud resources.
const site = new Website(config)
const processor = new WebsiteMediaProcessor(config);

// Stack outputs.
export const siteBucketName = site.bucket.resource.bucketDomainName;
export const siteBucketURL = site.bucket.resource.websiteEndpoint;
export const sourceBucketName = processor.resource.bucket;
export const distributionID = site.distribution.resource.id;
export const distributionURL = site.distribution.resource.domainName;
