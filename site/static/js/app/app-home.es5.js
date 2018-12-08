/*! Built with http://stenciljs.com */
App.loadBundle('app-home', ['exports', './chunk1.js'], function (exports, __chunk1_js) {
    var h = window.App.h;
    var Context = window.App.Context;
    /**
      * @name Route
      * @module ionic
      * @description
     */
    var RouteLink = /** @class */ (function () {
        function RouteLink() {
            this.unsubscribe = function () { return; };
            this.exact = false;
            this.custom = false;
            this.activeClass = "link-active";
            this.match = null;
        }
        // Identify if the current route is a match.
        RouteLink.prototype.computeMatch = function (pathname) {
            if (!pathname) {
                var location = this.activeRouter.get("location");
                pathname = location.pathname;
            }
            var match = __chunk1_js.matchPath(pathname, {
                path: this.urlMatch || this.url,
                exact: this.exact,
                strict: true
            });
            return match;
        };
        RouteLink.prototype.componentWillLoad = function () {
            var _this = this;
            // subscribe the project's active router and listen
            // for changes. Recompute the match if any updates get
            // pushed
            this.unsubscribe = this.activeRouter.subscribe(function () {
                _this.match = _this.computeMatch();
            });
            // Likely that this route link could receive a location prop
            this.match = this.computeMatch();
        };
        RouteLink.prototype.componentDidUnload = function () {
            // be sure to unsubscribe to the router so that we don't
            // get any memory leaks
            this.unsubscribe();
        };
        RouteLink.prototype.handleClick = function (e) {
            e.preventDefault();
            if (!this.activeRouter) {
                console.warn("<stencil-route-link> wasn't passed an instance of the router as the \"router\" prop!");
                return;
            }
            var history = this.activeRouter.get("history");
            return history.push(this.getUrl(this.url), {});
        };
        // Get the URL for this route link without the root from the router
        RouteLink.prototype.getUrl = function (url) {
            var root = this.activeRouter.get("root") || "/";
            // Don't allow double slashes
            if (url.charAt(0) == "/" && root.charAt(root.length - 1) == "/") {
                return root.slice(0, root.length - 1) + url;
            }
            return root + url;
        };
        RouteLink.prototype.render = function () {
            var classes = (_a = {},
                _a[this.activeClass] = this.match !== null,
                _a);
            if (this.custom) {
                return (h("span", { class: classes, onClick: this.handleClick.bind(this) }, h("slot", null)));
            }
            else {
                return (h("a", { class: classes, href: this.url, onClick: this.handleClick.bind(this) }, h("slot", null)));
            }
            var _a;
        };
        Object.defineProperty(RouteLink, "is", {
            get: function () { return "stencil-route-link"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(RouteLink, "properties", {
            get: function () { return { "activeClass": { "type": String, "attr": "active-class" }, "activeRouter": { "context": "activeRouter" }, "custom": { "type": Boolean, "attr": "custom" }, "exact": { "type": Boolean, "attr": "exact" }, "location": { "context": "location" }, "match": { "state": true }, "url": { "type": String, "attr": "url" }, "urlMatch": { "type": "Any", "attr": "url-match" } }; },
            enumerable: true,
            configurable: true
        });
        return RouteLink;
    }());
    var AppHome = /** @class */ (function () {
        function AppHome() {
        }
        AppHome.prototype.render = function () {
            return (h("div", { class: 'app-home' }, h("p", null, "Welcome to the Stencil App Starter. You can use this starter to build entire apps all with web components using Stencil! Check out our docs on ", h("a", { href: 'https://stenciljs.com' }, "stenciljs.com"), " to get started."), h("stencil-route-link", { url: '/profile/stencil' }, h("button", null, "Profile page"))));
        };
        Object.defineProperty(AppHome, "is", {
            get: function () { return "app-home"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AppHome, "style", {
            get: function () { return ".app-home {\n  padding: 10px;\n}\n\nbutton {\n  background: #5851ff;\n  color: white;\n  margin: 8px;\n  border: none;\n  font-size: 13px;\n  font-weight: 700;\n  text-transform: uppercase;\n  padding: 16px 20px;\n  border-radius: 2px;\n  box-shadow: 0 8px 16px rgba(0,0,0,.1), 0 3px 6px rgba(0,0,0,.08);\n  outline: 0;\n  letter-spacing: .04em;\n  transition: all .15s ease;\n  cursor: pointer;\n}\n  \nbutton:hover {\n  box-shadow: 0 3px 6px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.1);\n  transform: translateY(1px);\n}"; },
            enumerable: true,
            configurable: true
        });
        return AppHome;
    }());
    exports.StencilRouteLink = RouteLink;
    exports.AppHome = AppHome;
    Object.defineProperty(exports, '__esModule', { value: true });
});
