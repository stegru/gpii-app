/**
 * Metrics for the renderer
 *
 * Copyright 2019 Raising the Floor - International
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

    // Mix-in grade for components whose hover/focus state should be captured for metrics.
    fluid.defaults("gpii.psp.metrics", {
        gradeNames: ["gpii.app.hoverable"],
        members: {
            metricsID: "@expand:fluid.identity({that}.container.selectorName)"
        },
        invokers: {
            metric: {
                func: "{channelNotifier}.events.onMetric.fire",
                args: ["{arguments}.0", "{arguments}.1"]
            },
            setState: {
                func: "{channelNotifier}.events.onMetricState.fire",
                args: ["{arguments}.0", "{arguments}.1"]
            }
        },
        listeners: {
            "onCreate.getId": {
                funcName: "gpii.psp.metrics.getMetricsID",
                args: ["{that}", "{that}.model.item"]
            },
            "onCreate.addFocusHandlers": {
                funcName: "gpii.psp.metrics.addFocusHandlers",
                args: ["{that}", "{that}.container"]
            },
            "onMouseEnter.metricsState": {
                func: "{that}.setState",
                args: ["widget-hover", "{that}.metricsID"]
            },
            "onMouseLeave.metricsState": {
                func: "{that}.setState",
                args: ["widget-hover"]
            }
        }
    });

    /**
     * Gets a static string which is used to identify this component in metrics. The default value is the container's
     * selectorName, which is fit for purpose, however it's not available for dynamically generated components.
     *
     * @param {Component} that The gpii.psp.metrics instance.
     * @param {Object} modelItem [optional] The item member of the component's model.
     * @return {String} A string to identify this component, in human readable form.
     */
    gpii.psp.metrics.getMetricsID = function (that, modelItem) {
        if (that.metricsID === undefined) {
            if (modelItem) {
                that.metricsID = fluid.firstDefined(modelItem.key, modelItem.indicatorValue);
            }
            if (that.metricsID === undefined) {
                fluid.log("Unable to get metricsID for " + that.typeName);
                that.metricsID = that.typeName;
            }
        }

        return that.metricsID;
    };

    /**
     * Adds the focus and blur handlers to the container, so the metrics core can keep an eye on what's currently
     * focused.
     *
     * @param {Component} that The gpii.psp.metrics instance.
     * @param {jQuery} container A jQuery object representing the component's container.
     *
     */
    gpii.psp.metrics.addFocusHandlers = function (that, container) {
        container.on("focus", function () {
            that.setState("widget-focus", that.metricsID);
            that.metric("widget-focus", that.metricsID);
        });
        container.on("blur", function () {
            that.metric("widget-unfocus", that.metricsID);
            that.setState("widget-focus");
        });
    };

})(fluid, jQuery);