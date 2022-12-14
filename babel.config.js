
module.exports = (api) => {
    api.cache(false);
    return {
        parserOpts: {
            "plugins": ["jsx"],
        },
        plugins: [
            [require('@babel/plugin-transform-react-jsx'), {

            }],
        ],
        presets: [
            [require('@babel/preset-env'), {
                targets: { node: 'current', },
                loose: true,
            }],
            [require('@cocos/babel-preset-cc'), {
                allowDeclareFields: true,
            }],
        ],
    };
};
