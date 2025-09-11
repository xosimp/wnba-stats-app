"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatAlgorithms = exports.BOTTOM_1_PERCENT_THRESHOLDS = exports.TOP_1_PERCENT_THRESHOLDS = exports.LEAGUE_AVERAGES = void 0;
exports.getPercentile = getPercentile;
exports.computeDynamicThresholds = computeDynamicThresholds;
exports.formatPercentageDifference = formatPercentageDifference;
// League average stats (2025 WNBA season averages)
exports.LEAGUE_AVERAGES = {
    points: 13.2,
    rebounds: 5.4,
    assists: 3.3,
    turnovers: 2.3,
    steals: 1.3,
    blocks: 0.9,
    minutes: 29.1
};
// Top 1% thresholds for each stat (approximate 99th percentile)
exports.TOP_1_PERCENT_THRESHOLDS = {
    points: 21.0,
    rebounds: 9.0,
    assists: 5.5,
    turnovers: 3.8,
    steals: 2.5,
    blocks: 1.8,
    minutes: 34.0
};
// Bottom 1% thresholds for each stat (approximate 1st percentile)
exports.BOTTOM_1_PERCENT_THRESHOLDS = {
    points: 4.2,
    rebounds: 1.8,
    assists: 0.8,
    turnovers: 0.5, // Higher is worse for turnovers
    steals: 0.2,
    blocks: 0.1,
    minutes: 12.5
};
function getPercentile(values, percentile) {
    if (!values.length)
        return 0;
    var sorted = __spreadArray([], values, true).sort(function (a, b) { return a - b; });
    var idx = Math.ceil(percentile * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}
function computeDynamicThresholds(allPlayerStats) {
    var statKeys = ['points', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'minutes'];
    var top1 = {};
    var bottom1 = {};
    var leagueAvg = {};
    var _loop_1 = function (key) {
        var values = allPlayerStats.map(function (s) { var _a; return (_a = s[key]) !== null && _a !== void 0 ? _a : 0; }).filter(function (v) { return typeof v === 'number' && !isNaN(v); });
        if (values.length) {
            top1[key] = getPercentile(values, 0.99);
            bottom1[key] = getPercentile(values, 0.01);
            leagueAvg[key] = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        }
    };
    for (var _i = 0, statKeys_1 = statKeys; _i < statKeys_1.length; _i++) {
        var key = statKeys_1[_i];
        _loop_1(key);
    }
    return { top1: top1, bottom1: bottom1, leagueAvg: leagueAvg };
}
var StatAlgorithms = /** @class */ (function () {
    function StatAlgorithms() {
    }
    StatAlgorithms.compareToLeagueAverage = function (statKey, playerValue, dynamicThresholds) {
        var _a, _b, _c, _d, _e, _f;
        var leagueAverage = (_b = (_a = dynamicThresholds === null || dynamicThresholds === void 0 ? void 0 : dynamicThresholds.leagueAvg) === null || _a === void 0 ? void 0 : _a[statKey]) !== null && _b !== void 0 ? _b : exports.LEAGUE_AVERAGES[statKey];
        var top1PercentThreshold = (_d = (_c = dynamicThresholds === null || dynamicThresholds === void 0 ? void 0 : dynamicThresholds.top1) === null || _c === void 0 ? void 0 : _c[statKey]) !== null && _d !== void 0 ? _d : exports.TOP_1_PERCENT_THRESHOLDS[statKey];
        var bottom1PercentThreshold = (_f = (_e = dynamicThresholds === null || dynamicThresholds === void 0 ? void 0 : dynamicThresholds.bottom1) === null || _e === void 0 ? void 0 : _e[statKey]) !== null && _f !== void 0 ? _f : exports.BOTTOM_1_PERCENT_THRESHOLDS[statKey];
        if (!leagueAverage || playerValue === undefined || playerValue === null) {
            return {
                value: playerValue,
                isAboveAverage: false,
                isTop1Percent: false,
                color: '#D1D5DB',
                percentageDifference: 0
            };
        }
        var isAboveAverage = playerValue > leagueAverage;
        var percentageDifference = ((playerValue - leagueAverage) / leagueAverage) * 100;
        var isTop1Percent = false;
        var isBottom1Percent = false;
        if (statKey === 'turnovers') {
            isTop1Percent = playerValue <= top1PercentThreshold;
            isBottom1Percent = playerValue >= bottom1PercentThreshold;
        }
        else {
            isTop1Percent = playerValue >= top1PercentThreshold;
            isBottom1Percent = playerValue <= bottom1PercentThreshold;
        }
        var color;
        var performanceLabel;
        if (isTop1Percent) {
            color = '#FFD700';
            performanceLabel = 'Top 1%';
        }
        else if (isBottom1Percent) {
            color = '#FF6B6B';
            performanceLabel = 'Bottom 1%';
        }
        else if (isAboveAverage) {
            color = '#71FD08';
        }
        else {
            color = '#D1D5DB';
        }
        return {
            value: playerValue,
            isAboveAverage: isAboveAverage,
            isTop1Percent: isTop1Percent,
            color: color,
            percentageDifference: percentageDifference,
            performanceLabel: performanceLabel
        };
    };
    StatAlgorithms.getStatColor = function (statKey, playerValue, dynamicThresholds) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue, dynamicThresholds);
        return comparison.color;
    };
    StatAlgorithms.isTop1Percent = function (statKey, playerValue) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue);
        return comparison.isTop1Percent;
    };
    StatAlgorithms.isBottom1Percent = function (statKey, playerValue) {
        var bottom1PercentThreshold = exports.BOTTOM_1_PERCENT_THRESHOLDS[statKey];
        if (statKey === 'turnovers') {
            return playerValue >= bottom1PercentThreshold;
        }
        else {
            return playerValue <= bottom1PercentThreshold;
        }
    };
    StatAlgorithms.getPerformanceLabel = function (statKey, playerValue) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue);
        return comparison.performanceLabel;
    };
    StatAlgorithms.isAboveAverage = function (statKey, playerValue) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue);
        return comparison.isAboveAverage;
    };
    StatAlgorithms.getPercentageDifference = function (statKey, playerValue) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue);
        return comparison.percentageDifference;
    };
    StatAlgorithms.getLeagueAverage = function (statKey) {
        return exports.LEAGUE_AVERAGES[statKey] || 0;
    };
    StatAlgorithms.compareAllStats = function (playerStats) {
        var comparisons = {};
        Object.keys(playerStats).forEach(function (statKey) {
            var key = statKey;
            var value = playerStats[key];
            if (value !== undefined && value !== null) {
                comparisons[statKey] = _this.compareToLeagueAverage(key, value);
            }
        });
        return comparisons;
    };
    StatAlgorithms.getPerformanceIndicator = function (statKey, playerValue) {
        var comparison = this.compareToLeagueAverage(statKey, playerValue);
        if (comparison.percentageDifference > 20) {
            return 'Excellent';
        }
        else if (comparison.percentageDifference > 10) {
            return 'Good';
        }
        else if (comparison.percentageDifference > 0) {
            return 'Above Average';
        }
        else if (comparison.percentageDifference > -10) {
            return 'Below Average';
        }
        else if (comparison.percentageDifference > -20) {
            return 'Poor';
        }
        else {
            return 'Very Poor';
        }
    };
    return StatAlgorithms;
}());
exports.StatAlgorithms = StatAlgorithms;
function formatPercentageDifference(percentage) {
    var sign = percentage >= 0 ? '+' : '';
    return "".concat(sign).concat(percentage.toFixed(1), "%");
}
