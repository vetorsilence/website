import * as pulumi from "@pulumi/pulumi";

import { WebsiteBucket } from "./website-bucket";
import { WebsiteService } from "./website-service";
import { WebsiteDistribution } from "./website-distribution";

// Stack configuration.
const config = new pulumi.Config("website");

// Cloud resources.
const bucket = new WebsiteBucket(config);
const service = new WebsiteService(config);
const distribution = new WebsiteDistribution(config, bucket.resource);

// Export stack outputs.
export const bucketName = bucket.resource.bucketDomainName;
export const bucketURL = `http://${bucket.resource.websiteEndpoint}`;
export const distributionID = distribution.resource.id;
export const distributionURL = `http://${distribution.resource.domainName}`;
export const serviceEndpoint = service.resource.defaultEndpoint.apply(e => `http://${e.hostname}`);
