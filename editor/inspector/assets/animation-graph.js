exports.template = `
<section class="asset-animation-graph">
    <ui-button class="blue">Open Animation Graph Editor Panel</ui-button>
</section>
`;

exports.style = `
.asset-animation-graph {
   padding-top: 10px;
   text-align: center;
}
`;

exports.$ = {
    constainer: '.asset-animation-graph',
    button: 'ui-button',
};

exports.ready = function() {
    this.$.button.addEventListener('click', () => {
        Editor.Panel.open('animation-graph');
    });
};

exports.update = function() {

};

