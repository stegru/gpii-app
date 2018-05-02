/**
 * Repeater for markup elements
 *
 * Simple component for visual representation of a list of items with a
 * common markup.
 * Copyright 2017 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 * The research leading to these results has received funding from the European Union's
 * Seventh Framework Programme (FP7/2007-2013) under grant agreement no. 289016.
 * You may obtain a copy of the License at
 * https://github.com/GPII/universal/blob/master/LICENSE.txt
 */

/* global fluid */

"use strict";
(function (fluid) {
    var gpii = fluid.registerNamespace("gpii");

    /**
     * A component responsible for inserting the markup of an item and its
     * container in the DOM and for removing that markup when the component
     * gets destroyed. In order to accomplish the latter, the rendered
     * container is saved within the component.
     */
    fluid.defaults("gpii.psp.repeater.renderer", {
        gradeNames: "fluid.viewComponent",

        markup: {
            container: null,
            element:   null
        },

        model: {
            renderedContainer: null
        },
        events: {
            onElementRendered: {
                events: {
                    onContainerRendered: "onContainerRendered",
                    onMarkupRendered:    "onMarkupRendered"
                },
                args: ["{that}.model.renderedContainer"]
            },

            onContainerRendered: null,
            onMarkupRendered:    null
        },
        listeners: {
            "onDestroy.clearInjectedMarkup": {
                funcName: "gpii.psp.removeElement",
                args: "{that}.model.renderedContainer"
            }
        },
        components: {
            /*
             * Renders the container for the item's element, saves it and
             * notifies when done.
             */
            renderElementContainer: {
                type: "fluid.viewComponent",
                container: "{that}.container",
                options: {
                    listeners: {
                        "onCreate.render": {
                            this: "{that}.container",
                            method: "append",
                            args: ["{renderer}.options.markup.container"]
                        },
                        "onCreate.updateContainer": {
                            funcName: "{renderer}.setContainer",
                            args: "@expand:gpii.psp.getContainerLastChild({that}.container)",
                            priority: "after:render"
                        },
                        "onCreate.notify": {
                            funcName: "{renderer}.events.onContainerRendered.fire",
                            // Get the newly created container
                            priority: "after:updateContainer"
                        }
                    }
                }
            },
            /**
             * Renders the markup of the item inside the dedicated container.
             */
            renderElementMarkup: {
                type: "fluid.viewComponent",
                container: "{that}.model.renderedContainer",
                createOnEvent: "onContainerRendered",
                options: {
                    listeners: {
                        "onCreate.render": {
                            this: "{that}.container",
                            method: "append",
                            args: "{renderer}.options.markup.element"
                        },
                        "onCreate.notify": {
                            funcName: "{renderer}.events.onMarkupRendered.fire",
                            args: ["{that}.model.renderedContainer"],
                            priority: "after:render"
                        }
                    }
                }
            }
        },
        invokers: {
            setContainer: {
                changePath: "renderedContainer",
                value: "{arguments}.0"
            }
        }
    });


    /**
     * A component which injects all the necessary markup for an item and
     * initializes a handler of the corresponding `handlerType` to visualize
     * a given item.
     * Some of the component's options are the `item` which is to be visualized
     * together with its `index` in the array of `items` from the `repeater`,
     * the actual `markup` of both the container and the item itself which is
     * to be inserted in the DOM and the `handlerType`.
     */
    fluid.defaults("gpii.psp.repeater.element", {
        gradeNames: "fluid.viewComponent",

        item:        null,
        index:       null,
        handlerType: null,

        markup: {
            container: null,
            element:   null
        },

        events: {
            onElementRendered: null // fired when the rendering of the item completes
        },

        components: {
            renderer: {
                type: "gpii.psp.repeater.renderer",
                container: "{that}.container",
                options: {
                    markup: "{element}.options.markup",

                    listeners: {
                        onElementRendered: "{element}.events.onElementRendered.fire"
                    }
                }
            },
            handler: {
                type: "{that}.options.handlerType",
                createOnEvent: "onElementRendered",
                container: "{arguments}.0",
                options: {
                    model: {
                        item: "{element}.options.item"
                    }
                }
            }
        }
    });


    /**
     * A component for visualizing multiple "similar" objects (such as settings,
     * setting groups or image dropdown menu items). The component expects:
     * - an `items` array in its model describing each of the items to be visualized.
     * - a `handlerType` option which contains the grade name of a component which
     * will be in charge of visually representing a single item.
     * - a `getMarkup` invoker which accepts two arguments - the current item and
     * its index in the array of `items` and returns the markup which is to be
     * inserted in the DOM for the given item.
     * - a `dynamicContainerMarkup` which holds the markup of the `container` in which
     * the markup for the item returned by `getMarkup` will be inserted, as well as
     * a `containerClassPrefix` which together with the index of the current item will
     * be used to create a unique class name for the item's container.
     */
    fluid.defaults("gpii.psp.repeater", {
        gradeNames: "fluid.viewComponent",

        model: {
            items: []
        },
        handlerType: null,

        invokers: {
            getMarkup: {
                funcName: "fluid.notImplemented",
                args: ["{arguments}.0"] // item
            }
        },

        dynamicContainerMarkup: {
            container:            "<div class=\"%containerClass\"></div>",
            containerClassPrefix: "flc-dynamicElement-%id" // preferably altered by the implementor
        },

        dynamicComponents: {
            element: {
                type: "gpii.psp.repeater.element",
                container: "{that}.container",
                sources: "{repeater}.model.items",
                options: {
                    index: "{sourcePath}",
                    item:  "{source}",
                    handlerType: "{repeater}.options.handlerType",

                    markup: {
                        container: {
                            expander: {
                                funcName: "gpii.psp.repeater.getIndexedContainerMarkup",
                                args: [
                                    "{repeater}.options.dynamicContainerMarkup",
                                    "{that}.options.index"
                                ]
                            }
                        },
                        // generated dynamicaly using the current item
                        element: "@expand:{repeater}.getMarkup({that}.options.item, {that}.options.index)"
                    }
                }
            }
        }
    });

    /**
     * Constructs the markup for the indexed container - sets proper index.
     *
     * @param markup {Object}
     * @param markup.containerClassPrefix {String} The class prefix for the indexed container.
     *   Should have a `id` interpolated expression.
     * @param markup.container {String} The markup which is to be interpolated with the container index.
     *   Should have a `containerClass` interpolated expression.
     * @param containerIndex {Number} The index for the container
     * @returns {String}
     */
    gpii.psp.repeater.getIndexedContainerMarkup = function (markup, containerIndex) {
        var containerClass = fluid.stringTemplate(markup.containerClassPrefix, { id: containerIndex });
        return fluid.stringTemplate(markup.container, { containerClass: containerClass });
    };

    /**
     * Utility function for retrieving the last  child element of a container.
     * @param container {jQuery} The jQuery container object
     * @return {jQuery} A jQuery container object representing the last child
     * element if any.
     */
    gpii.psp.getContainerLastChild = function (container) {
        return container.children().last();
    };

    /**
     * Removes the provided element from the DOM.
     * @param container {jQuery} A jQuery object representing the element to
     * be removed.
     */
    gpii.psp.removeElement = function (element) {
        if (element) {
            element.remove();
        }
    };
})(fluid);