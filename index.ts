import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as fs from 'fs';
import * as mime from 'mime';
import * as glob from 'glob';

const siteDir = 'site/public/';
const files = glob.sync(`${siteDir}/**/*`);

const bucket = new aws.s3.Bucket('nunciato-christian', {
  website: {
    indexDocument: 'index.html',
    errorDocument: '404.html'
  }
});

files.forEach((path: string) => {
  if (!fs.lstatSync(path).isDirectory()) {
    let object = new aws.s3.BucketObject(path.replace(siteDir, ''), { 
      bucket: bucket,
      source: new pulumi.asset.FileAsset(path),
      contentType: mime.getType(path) || undefined
    });
  }
});

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

const bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {   
  bucket: bucket.bucket,
  policy: bucket.bucket.apply(publicReadPolicyForBucket)
});

const stackConfig = new pulumi.Config('static-website');

const config = {
    targetDomain: stackConfig.require('targetDomain'),
    certificateArn: stackConfig.require('certificateArn')
};

const tenMinutes = 60 * 10;

const distributionArgs = {
  enabled: true,

  aliases: [
    config.targetDomain
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
    defaultTtl: tenMinutes,
    maxTtl: tenMinutes,
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
    acmCertificateArn: config.certificateArn,
    sslSupportMethod: 'sni-only'
  }
};

const cdn = new aws.cloudfront.Distribution('cdn', distributionArgs);

export const bucketName = bucket.bucketDomainName;
export const bucketUrl = bucket.websiteEndpoint;
export const cloudfrontUrl = cdn.domainName;
