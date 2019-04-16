import * as pulumi from '@pulumi/pulumi';
import * as cloud from "@pulumi/cloud";
import * as aws from '@pulumi/aws';
import * as fs from 'fs';
import * as mime from 'mime';
import * as glob from 'glob';

// Our Pulumi stack config.
const config = new pulumi.Config('website');

// The folder into which the static site is rendered. Files are expected to be here
// when this application runs.
const siteDir = 'site/public/';

// The destination S3 bucket.
const bucket = new aws.s3.Bucket('cnunciato-website', {
  website: {
    indexDocument: 'index.html',
    errorDocument: '404.html'
  }
});

// The files comprising the website, which will ultimately be copied to S3.
const files = glob.sync(`${siteDir}/**/*`);

// For each file, create a new S3 bucket object for Pulumi to manage.
files.forEach((path: string) => {
  if (!fs.lstatSync(path).isDirectory()) {
    let object = new aws.s3.BucketObject(path.replace(siteDir, ''), {
      bucket: bucket,
      source: new pulumi.asset.FileAsset(path),
      contentType: mime.getType(path) || undefined
    });
  }
});

// Define an access policy allowing public read access to all objects in the bucket.
const publicReadPolicyForBucket = (name: string) => {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: '*',
      Action: [
        's3:GetObject'
      ],
      Resource: [
        `arn:aws:s3:::${name}/*`
      ]
    }]
  })
}

// Associate the policy with the bucket.
const bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {
  bucket: bucket.bucket,
  policy: bucket.bucket.apply(publicReadPolicyForBucket)
});

// Cache distributed objects for ten minutes.
const cacheTtl = 60 * 10;

// Define the properties of the CloudFront distribution.
const distributionArgs = {
  enabled: true,
  aliases: [
    config.require('targetDomain')
  ],
  origins: [
    {
      originId: bucket.arn,
      domainName: bucket.websiteEndpoint,
      customOriginConfig: {
        originProtocolPolicy: 'http-only',
        httpPort: 80,
        httpsPort: 443,
        originSslProtocols: ['TLSv1.2'],
      },
    }
  ],
  defaultRootObject: 'index.html',
  defaultCacheBehavior: {
    targetOriginId: bucket.arn,
    viewerProtocolPolicy: 'redirect-to-https',
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD', 'OPTIONS'],
    defaultTtl: cacheTtl,
    maxTtl: cacheTtl,
    minTtl: 0,
    forwardedValues: {
      cookies: { forward: 'none' },
      queryString: false,
    }
  },
  priceClass: 'PriceClass_100',
  customErrorResponses: [
    {
      errorCode: 404,
      responseCode: 404,
      responsePagePath: '/404.html'
    }
  ],
  restrictions: {
    geoRestriction: {
      restrictionType: 'none'
    }
  },
  viewerCertificate: {
    acmCertificateArn: config.require('certificateArn'),
    sslSupportMethod: 'sni-only'
  }
};

// Define the CloudFromt distribution.
const cdn = new aws.cloudfront.Distribution('cdn', distributionArgs);

// Define the Parse application, which receives HTTP posts and creates new content from them.
let service = new cloud.Service("parse", {
    containers: {
        parse: {
            image: "cnunciato/parse:latest",
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

// Export our stack outputs.
export const bucketName = bucket.bucketDomainName;
export const bucketUrl = bucket.websiteEndpoint;
export const cloudfrontUrl = cdn.domainName;
export const cloudfrontDistributionId = cdn.id;
export const parseEndpoint = service.defaultEndpoint.apply(e => `http://${e.hostname}`);
