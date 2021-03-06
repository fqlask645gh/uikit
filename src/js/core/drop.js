import { Position, Togglable } from '../mixin/index';
import { $$, addClass, Animation, attr, css, docEl, includes, isString, isTouch, MouseTracker, offset, on, once, pointerEnter, pointerLeave, pointInRect, Promise, query, removeClass, removeClasses, toggleClass, trigger, win, within } from '../util/index';

export default function (UIkit) {

    var active;

    UIkit.component('drop', {

        mixins: [Position, Togglable],

        args: 'pos',

        props: {
            mode: 'list',
            toggle: Boolean,
            boundary: 'query',
            boundaryAlign: Boolean,
            delayShow: Number,
            delayHide: Number,
            clsDrop: String
        },

        defaults: {
            mode: ['click', 'hover'],
            toggle: true,
            boundary: win,
            boundaryAlign: false,
            delayShow: 0,
            delayHide: 800,
            clsDrop: false,
            hoverIdle: 200,
            animation: ['uk-animation-fade'],
            cls: 'uk-open'
        },

        computed: {

            toggle({toggle}) {
                return toggle && UIkit.toggle(isString(toggle) ? query(toggle, this.$el) : this.$el.previousElementSibling, {target: this.$el, mode: this.mode});
            },

            clsDrop({clsDrop}) {
                return clsDrop || `uk-${this.$options.name}`;
            },

            clsPos() {
                return this.clsDrop;
            }

        },

        init() {
            this.tracker = new MouseTracker();
            addClass(this.$el, this.clsDrop);
        },

        connected() {
            this.updateAria(this.$el);
            Promise.resolve().then(() => this.toggle); // access computed toggle
        },

        events: [

            {

                name: 'click',

                delegate() {
                    return `.${this.clsDrop}-close`;
                },

                handler(e) {
                    e.preventDefault();
                    this.hide(false);
                }

            },

            {

                name: 'click',

                delegate() {
                    return 'a[href^="#"]';
                },

                handler(e) {

                    if (e.defaultPrevented) {
                        return;
                    }

                    var id = e.target.hash;

                    if (!id) {
                        e.preventDefault();
                    }

                    if (!id || !within(id, this.$el)) {
                        this.hide(false);
                    }
                }

            },

            {

                name: 'beforescroll',

                handler() {
                    this.hide(false);
                }

            },

            {

                name: 'toggle',

                self: true,

                handler(e, toggle) {

                    e.preventDefault();

                    if (this.isToggled()) {
                        this.hide(false);
                    } else {
                        this.show(toggle, false);
                    }
                }

            },

            {

                name: pointerEnter,

                filter() {
                    return includes(this.mode, 'hover');
                },

                handler(e) {

                    if (isTouch(e)) {
                        return;
                    }

                    if (active
                        && active !== this
                        && active.toggle
                        && includes(active.toggle.mode, 'hover')
                        && !within(e.target, active.toggle.$el)
                        && !pointInRect({x: e.pageX, y: e.pageY}, offset(active.$el))
                    ) {
                        active.hide(false);
                    }

                    e.preventDefault();
                    this.show(this.toggle);
                }

            },

            {

                name: 'toggleshow',

                handler(e, toggle) {

                    if (toggle && !includes(toggle.target, this.$el)) {
                        return;
                    }

                    e.preventDefault();
                    this.show(toggle || this.toggle);
                }

            },

            {

                name: `togglehide ${pointerLeave}`,

                handler(e, toggle) {

                    if (isTouch(e) || toggle && !includes(toggle.target, this.$el)) {
                        return;
                    }

                    e.preventDefault();

                    if (this.toggle && includes(this.toggle.mode, 'hover')) {
                        this.hide();
                    }
                }

            },

            {

                name: 'beforeshow',

                self: true,

                handler() {
                    this.clearTimers();
                }

            },

            {

                name: 'show',

                self: true,

                handler() {
                    this.tracker.init();
                    addClass(this.toggle.$el, this.cls);
                    attr(this.toggle.$el, 'aria-expanded', 'true');
                    registerEvent();
                }

            },

            {

                name: 'beforehide',

                self: true,

                handler() {
                    this.clearTimers();
                }

            },

            {

                name: 'hide',

                handler({target}) {

                    if (this.$el !== target) {
                        active = active === null && within(target, this.$el) && this.isToggled() ? this : active;
                        return;
                    }

                    active = this.isActive() ? null : active;
                    removeClass(this.toggle.$el, this.cls);
                    attr(this.toggle.$el, 'aria-expanded', 'false');
                    this.toggle.$el.blur();
                    $$('a, button', this.toggle.$el).forEach(el => el.blur());
                    this.tracker.cancel();
                }

            }

        ],

        update: {

            write() {

                if (this.isToggled() && !Animation.inProgress(this.$el)) {
                    this.position();
                }

            },

            events: ['resize']

        },

        methods: {

            show(toggle, delay = true) {

                var show = () => {
                        if (!this.isToggled()) {
                            this.position();
                            this.toggleElement(this.$el, true);
                        }
                    },
                    tryShow = () => {

                        this.toggle = toggle || this.toggle;

                        this.clearTimers();

                        if (this.isActive()) {
                            return;
                        } else if (delay && active && active !== this && active.isDelaying) {
                            this.showTimer = setTimeout(this.show, 10);
                            return;
                        } else if (this.isParentOf(active)) {

                            if (active.hideTimer) {
                                active.hide(false);
                            } else {
                                return;
                            }

                        } else if (active && !this.isChildOf(active) && !this.isParentOf(active)) {

                            var prev;
                            while (active && active !== prev && !this.isChildOf(active)) {
                                prev = active;
                                active.hide(false);
                            }

                        }

                        if (delay && this.delayShow) {
                            this.showTimer = setTimeout(show, this.delayShow);
                        } else {
                            show();
                        }

                        active = this;
                    };

                if (toggle && this.toggle && toggle.$el !== this.toggle.$el) {

                    once(this.$el, 'hide', tryShow);
                    this.hide(false);

                } else {
                    tryShow();
                }
            },

            hide(delay = true) {

                var hide = () => this.toggleNow(this.$el, false);

                this.clearTimers();

                this.isDelaying = this.tracker.movesTo(this.$el);

                if (delay && this.isDelaying) {
                    this.hideTimer = setTimeout(this.hide, this.hoverIdle);
                } else if (delay && this.delayHide) {
                    this.hideTimer = setTimeout(hide, this.delayHide);
                } else {
                    hide();
                }
            },

            clearTimers() {
                clearTimeout(this.showTimer);
                clearTimeout(this.hideTimer);
                this.showTimer = null;
                this.hideTimer = null;
                this.isDelaying = false;
            },

            isActive() {
                return active === this;
            },

            isChildOf(drop) {
                return drop && drop !== this && within(this.$el, drop.$el);
            },

            isParentOf(drop) {
                return drop && drop !== this && within(drop.$el, this.$el);
            },

            position() {

                removeClasses(this.$el, `${this.clsDrop}-(stack|boundary)`);
                css(this.$el, {top: '', left: '', display: 'block'});
                toggleClass(this.$el, `${this.clsDrop}-boundary`, this.boundaryAlign);

                var boundary = offset(this.boundary),
                    alignTo = this.boundaryAlign ? boundary : offset(this.toggle.$el);

                if (this.align === 'justify') {
                    var prop = this.getAxis() === 'y' ? 'width' : 'height';
                    css(this.$el, prop, alignTo[prop]);
                } else if (this.$el.offsetWidth > Math.max(boundary.right - alignTo.left, alignTo.right - boundary.left)) {
                    addClass(this.$el, `${this.clsDrop}-stack`);
                    trigger(this.$el, 'stack', [this]);
                }

                this.positionAt(this.$el, this.boundaryAlign ? this.boundary : this.toggle.$el, this.boundary);

                css(this.$el, 'display', '');

            }

        }

    });

    UIkit.drop.getActive = () => active;

    var registered;

    function registerEvent() {

        if (registered) {
            return;
        }

        registered = true;
        on(docEl, 'click', ({target, defaultPrevented}) => {
            var prev;

            if (defaultPrevented) {
                return;
            }

            while (active && active !== prev && !within(target, active.$el) && !(active.toggle && within(target, active.toggle.$el))) {
                prev = active;
                active.hide(false);
            }
        });
    }

}
