'use strict';

/*global Chartist*/
App.StatsChartComponent = Ember.Component.extend({
    range: 14,
    type: '',
    legend: [],
    id: '',

    colors: [
        '#d70206',
        '#f05b4f',
        '#f4c63d',
        '#d17905',
        '#453d3f',
        '#59922b',
        '#0544d3',
        '#6b0392',
        '#f05b4f',
        '#dda458',
        '#eacf7d',
        '#86797d',
        '#b2c326',
        '#6188e2',
        '#a748ca'
    ],

    actions: {
        changeType: function(type) {
            this.set('type', type);
            this.update();
        }
    },

    init: function() {
        this._super();
        this.loadState();
    },

    didInsertElement: function() {
        $('#' + this.elementId + ' .range-select').on('change', _.bind(function(e) {
            this.set('range', +$(e.target).val());
        }, this));

        this._super();
        this.update();
    },

    saveState: function() {
        window.localStorage.setItem('admin-stats-chart-' + this.get('id') + '.type', this.get('type'));
        window.localStorage.setItem('admin-stats-chart-' + this.get('id') + '.range', this.get('range'));
    },

    loadState: function() {
        this.set('type', window.localStorage.getItem('admin-stats-chart-' + this.get('id') + '.type') || '');
        this.set('range', window.localStorage.getItem('admin-stats-chart-' + this.get('id') + '.range') || 14);
    },

    update: function() {
        this.saveState();

        $.get(sprintf('/api/v1.0/admin/stats?cache=%s&range=%s&type=%s', Date.now(), this.get('range'), this.get('type'))).success(_.bind(function(data) {
            var chartSelector = '#' + this.elementId + ' .ct-chart',
                legend = [];

            if (data.dates.length) {
                _.each(data.series, function(s, i) {
                    if (s !== 'other') {
                        legend.push({
                            style: ('color:' + this.colors[i % this.colors.length]).htmlSafe(),
                            name: s.name
                        });
                    }
                }, this);
            }

            _.sortBy(legend, function(item) {
                return item.name;
            });

            this.set('legend', legend);

            if (legend.length === 0) {
                return;
            }

            Ember.run.scheduleOnce('afterRender', this, function() {
                new Chartist.Line(chartSelector, {
                    labels: data.dates,
                    series: data.series
                }, {
                    fullWidth: true,
                    height: 300,
                    chartPadding: {
                        right: 40
                    }
                });

                var lineChart = $(chartSelector);

                var toolTip = lineChart
                    .append('<div class="tooltip"></div>')
                    .find('.tooltip')
                    .hide();

                lineChart.on('mouseenter', '.ct-point', function() {
                    var $point = $(this),
                        value = $point.attr('ct:value'),
                        seriesName = $point.parent().attr('ct:series-name');
                    toolTip.html(seriesName + '<br>' + value).show();
                });

                lineChart.on('mouseleave', '.ct-point', function() {
                    toolTip.hide();
                });

                lineChart.on('mousemove', function(event) {
                    toolTip.css({
                        opacity: 1,
                        left: (event.offsetX || event.originalEvent.layerX) - toolTip.width() / 2 - 10,
                        top: (event.offsetY || event.originalEvent.layerY) - toolTip.height() - 40
                    });
                });
            });
        }, this));
    }.observes('range', 'type')
});
