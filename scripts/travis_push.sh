echo "Travis push job"

# Update the stack
case ${TRAVIS_BRANCH} in
    master)
        pulumi stack select cnunciato/christian-dev
        pulumi update --yes
        ;;
    *)
        echo "No Pulumi stack associated with branch ${TRAVIS_BRANCH}."
        ;;
esac
