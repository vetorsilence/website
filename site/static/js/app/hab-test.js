/*! Built with http://stenciljs.com */
const { h, Context } = window.App;

class AppProfile {
    render() {
        return (h("div", null,
            h("p", { class: 'foo', title: 'other-thing' }, "Hey, look at me I'm a web component! Yay!")));
    }
    static get is() { return "hab-test"; }
    static get style() { return ""; }
}

export { AppProfile as HabTest };
