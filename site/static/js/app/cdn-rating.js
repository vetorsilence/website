/*! Built with http://stenciljs.com */
const { h, Context } = window.App;

class AppProfile {
    constructor() {
        this.rating = 0;
    }
    render() {
        return (h("span", { class: "rating" }, ['*', '*', '*', '*', '*'].map((_s, i) => h("span", { class: i + 1 <= this.rating ? 'active' : 'inactive' }, "\u2605"))));
    }
    static get is() { return "cdn-rating"; }
    static get properties() { return { "rating": { "type": Number, "attr": "rating" } }; }
    static get style() { return "cdn-rating {\n  color: #ddd;\n}\n\ncdn-rating .active {\n  color: #FFDA42;\n}"; }
}

export { AppProfile as CdnRating };
