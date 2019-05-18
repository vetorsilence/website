#!/bin/bash

echo "Travis push job"

# Update the stack
case ${TRAVIS_BRANCH} in
    master)
        pushd infra
            npm install
        popd

        pushd components
            npm install
        popd

        pulumi stack select cnunciato/website/dev --cwd infra
        pulumi update --yes --cwd infra
        ;;
    *)
        echo "No Pulumi stack associated with branch ${TRAVIS_BRANCH}."
        ;;
esac
