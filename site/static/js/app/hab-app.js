/*! Built with http://stenciljs.com */
const { h, Context } = window.App;

class App {
    render() {
        return (h("div", null,
            h("header", null,
                h("h1", null, "Stencil Components")),
            h("hab-test", null)));
    }
    static get is() { return "hab-app"; }
    static get style() { return "my-app header {\n  background: #5851ff;\n  color: white;\n  height: 56px;\n  display: flex;\n  align-items: center;\n  box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.26);\n}\n\nmy-app h1 {\n  font-size: 1.4rem;\n  font-weight: 500;\n  color: #fff;\n  padding: 0 12px;\n}"; }
}

export { App as HabApp };
