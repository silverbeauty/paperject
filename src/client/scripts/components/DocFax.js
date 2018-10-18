'use strict';

/*global Ladda,PDFJS,intlTelInputUtils*/

App.DocFaxComponent = Ember.Component.extend({
    visible: false,
    number: '',
    pages: null,
    user: null,
    store: null,
    doc: null,
    submitSpinner: null,
    pdfExportService: null, // injected by the app
    pdfJsLoaderService: null, // injected
    faxLabel: '',
    errorMessage: '',
    numberPlaceholder: '',
    numberCountry: '',

    supportedNumber: false,
    faxNumberNotInitialized: true,

    supportedCountryIsoCodes: {
        al: 'Albania',
        dz: 'Algeria',
        as: 'American Samoa',
        ad: 'Andorra',
        ao: 'Angola',
        ai: 'Anguilla',
        ag: 'Antigua and Barbuda',
        ar: 'Argentina',
        am: 'Armenia',
        aw: 'Aruba',
        au: 'Australia',
        at: 'Austria',
        ba: 'Bosnia/Herzegovina',
        bh: 'Bahrain',
        bd: 'Bangladesh',
        bb: 'Barbados',
        be: 'Belgium',
        bm: 'Bermuda',
        bo: 'Bolivia',
        bw: 'Botswana',
        br: 'Brazil',
        vg: 'British Virgin Islands',
        bn: 'Brunei',
        bg: 'Bulgaria',
        kh: 'Cambodia',
        ca: 'Canada',
        ky: 'Cayman Islands',
        cl: 'Chile',
        cn: 'China',
        co: 'Colombia',
        cr: 'Costa Rica',
        hr: 'Croatia',
        cy: 'Cyprus',
        cz: 'Czech Republic',
        dk: 'Denmark',
        'do': 'Dominican Republic',
        ec: 'Ecuador',
        eg: 'Egypt',
        ee: 'Estonia',
        fi: 'Finland',
        fr: 'France',
        gf: 'French Guiana',
        ge: 'Georgia',
        de: 'Germany',
        gi: 'Gibraltar',
        gr: 'Greece',
        gd: 'Grenada',
        gp: 'Guadeloupe',
        gu: 'Guam',
        gt: 'Guatemala',
        hk: 'Hong Kong',
        hu: 'Hungary',
        is: 'Iceland',
        io: 'India',
        id: 'Indonesia',
        ir: 'Iran',
        iq: 'Iraq',
        ie: 'Ireland',
        il: 'Israel',
        it: 'Italy',
        jm: 'Jamaica',
        jp: 'Japan',
        jo: 'Jordan',
        ke: 'Kenya',
        kw: 'Kuwait',
        kg: 'Kyrgyzstan',
        la: 'Laos',
        lv: 'Latvia',
        lb: 'Lebanon',
        li: 'Liechtenstein',
        lt: 'Lithuania',
        lu: 'Luxembourg',
        mo: 'Macau',
        mk: 'Macedonia',
        mw: 'Malawi',
        my: 'Malaysia',
        mt: 'Malta',
        mx: 'Mexico',
        md: 'Moldova',
        mc: 'Monaco',
        me: 'Montenegro',
        ma: 'Morocco',
        mz: 'Mozambique',
        na: 'Namibia',
        bq: 'Netherlands',
        nz: 'New Zealand',
        ni: 'Nicaragua',
        ng: 'Nigeria',
        no: 'Norway',
        mp: 'Northern Mariana Islands',
        om: 'Oman',
        pk: 'Pakistan',
        pa: 'Panama',
        py: 'Paraguay',
        pe: 'Peru',
        ph: 'Philippines',
        pl: 'Poland',
        pt: 'Portugal',
        pr: 'Puerto Rico',
        ro: 'Romania',
        ru: 'Russia',
        rw: 'Rwanda',
        sm: 'San Marino',
        sa: 'Saudi Arabia',
        rs: 'Serbia',
        sg: 'Singapore',
        sk: 'Slovakia',
        si: 'Slovenia',
        za: 'South Africa',
        kr: 'South Korea',
        es: 'Spain',
        lk: 'Sri Lanka',
        se: 'Sweden',
        ch: 'Switzerland',
        tw: 'Taiwan',
        tj: 'Tajikistan',
        th: 'Thailand',
        tt: 'Trinidad and Tobago',
        tr: 'Turkey',
        ug: 'Uganda',
        ua: 'Ukraine',
        ae: 'United Arab Emirates',
        gb: 'United Kingdom',
        us: 'United States',
        vi: 'U.S. Virgin Islands',
        uy: 'Uruguay',
        uz: 'Uzbekistan',
        va: 'Vatican City',
        ve: 'Venezuela',
        vn: 'Vietnam',
        zm: 'Zambia',
        zw: 'Zimbabwe'
    },

    numberCountrySample: Ember.computed.and('numberPlaceholder', 'numberCountry'),

    actions: {
        submit: function() {
            this.sendFax();
        },

        sendAnyway: function() {
            this.prepareFax();
        }
    },

    resetFields: function() {
        if (this.get('visible')) {
            this.setProperties({
                number: '',
                faxLabel: 'Please enter a number below',
                errorMessage: '',
                numberPlaceholder: '',
                numberCountry: ''
            });
        }
    }.observes('visible'),

    getPageCount: function() {
        if (!this.get('doc.pageCount')) {
            // in case when for some reasons pageCount is not saved in the document
            // for example, user refreshed page after upload, before file was processed by PDFJS
            this.pdfJsLoaderService.load(function() {
                PDFJS.getDocument(this.get('doc.fileUrl')).then(_.bind(function(pdf) {
                    this.set('doc.pageCount', pdf.numPages);
                }, this));
            }, this);
        }
    }.observes('doc'),

    isInsufficientBalance: function() {
        return !this.get('doc.pageCount') || this.get('doc.pageCount') > this.get('user.metrics.faxPages');
    }.property('doc.pageCount', 'user.metrics.faxPages'),

    isSendDisallowed: function() {
        return this.get('isInsufficientBalance') || !this.get('supportedNumber');
    }.property('isInsufficientBalance', 'supportedNumber'),

    didInsertElement: function() {
        this.set('submitSpinner', Ladda.create(this.$('.btn-send')[0]));

        // init form validation plugin
        this.$('form').validate({
            rules: {
                number: {
                    required: true,
                    simplifiedPhoneValidation: true
                }
            },

            highlight: function(label) {
                $(label).closest('.form-group').addClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
            },

            unhighlight: function(label) {
                $(label).closest('.form-group').removeClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
            },

            errorPlacement: function(error, element) {
                $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
            },

            submitHandler: _.bind(this.submitFax, this)
        });

        var faxNumberEl = this.getNumberEl();

        faxNumberEl.on('keyup change', _.bind(function(e) {
            this.set('errorMessage', '');

            var intlNumber = this.isNumberFormatRecognized() ? this.getInternationalNumber(true) : '';

            if (intlNumber) {
                this.set('faxLabel', 'International: ' + intlNumber);
            } else {
                this.set('faxLabel', 'Please enter a number below');
            }
        }, this));
    },

    initFaxNumber: function() {
        if (this.get('visible') && this.get('faxNumberNotInitialized')) {
            // cache fax-country to avoid hitting ipinfo request limits
            var country = window.clientStorage.readValue('fax-country'),
                initTelInput = function(country) {
                    var faxNumberEl = this.getNumberEl();

                    faxNumberEl.intlTelInput({
                        defaultCountry: country,
                        nationalMode: true
                    });

                    this.set('faxNumberNotInitialized', false);
                };

            if (_.isString(country)) { // may be ''
                initTelInput.call(this, country);
            } else {
                $.get('//ipinfo.io', function() {}, 'jsonp').always(_.bind(function(resp) {
                    var countryCode = (resp && resp.country) ? resp.country.toLowerCase() : '';
                    window.clientStorage.storeValue('fax-country', countryCode);
                    initTelInput.call(this, countryCode);
                }, this));
            }
        }
    }.observes('visible'),

    getInternationalNumber: function(format) {
        var faxNumberEl = this.getNumberEl(),
            number = faxNumberEl.intlTelInput('getNumber');

        if (format) {
            var countryData = faxNumberEl.intlTelInput('getSelectedCountryData');

            if (!this.supportedCountryIsoCodes[countryData.iso2]) {
                this.set('errorMessage', 'Sending faxes to ' + countryData.name + ' is not supported yet. Please contact support@paperjet.com for more details.');
                this.set('supportedNumber', false);
            } else {
                this.set('supportedNumber', true);
            }

            if (number.charAt(0) === '+') {
                number = intlTelInputUtils.formatNumberByType(number, countryData.iso2, intlTelInputUtils.numberFormat.INTERNATIONAL);
            } else {
                number = intlTelInputUtils.formatNumber(number, countryData.iso2, false, false);
            }
        }

        return number;
    },

    getErrorMessage: function() {
        var error = this.getNumberEl().intlTelInput('getValidationError'),
            errorCodes = intlTelInputUtils.validationError;

        switch (error) {
            case errorCodes.INVALID_COUNTRY_CODE:
                return 'Country code is invalid';
            case errorCodes.TOO_SHORT:
                return 'Number is too short';
            case errorCodes.TOO_LONG:
                return 'Number is too long';
            case errorCodes.NOT_A_NUMBER:
                return 'Not a valid phone number';
        }

        return '';
    },

    isNumberFormatRecognized: function() {
        var val = this.getNumberEl().val(),
            countryData = this.getNumberEl().intlTelInput('getSelectedCountryData'),
            formatted;

        this.set('numberPlaceholder', countryData ? intlTelInputUtils.getExampleNumber(countryData.iso2, true, intlTelInputUtils.numberType.MOBILE) : '');
        this.set('numberCountry', countryData ? countryData.name : '');

        val = val.replace(/ /g, '');

        if (val.charAt(0) === '+') {
            formatted = intlTelInputUtils.formatNumberByType(val, countryData.iso2, intlTelInputUtils.numberFormat.NATIONAL);
        } else {
            formatted = intlTelInputUtils.formatNumber(val, countryData.iso2, false, false);
        }

        return val !== formatted;
    },

    submitFax: function() {
        var error = this.getErrorMessage();

        if (error) {
            this.set('errorMessage', error);
            return;
        }

        this.set('errorMessage', '');

        if (!this.isNumberFormatRecognized()) {
            $('#fax-number-notification-modal').modal('show');
        } else {
            this.prepareFax();
        }
    },

    prepareFax: function() {
        this.submitSpinner.start();
        this.pdfExportService.exportPages(this.doc, this.pages, this.sendFax, this);
    },

    sendFax: function(pdf) {
        var config = {
            number: this.getInternationalNumber(false),
            pageCount: this.get('doc.pageCount'),
            tzOffset: ((new Date()).getTimezoneOffset()) / 60
        };

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('doc.id')),
            type: 'POST',
            data: JSON.stringify({
                action: 'fax',
                fax: config,
                pdf: pdf
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: this.onFaxSent,
            error: function(xhr, textStatus, errorThrown) {
                if (xhr.status === 200) {
                    this.onFaxSent();
                } else {
                    var message = 'Failed to send fax.';

                    if (xhr.responseText) {
                        try {
                            message = JSON.parse(xhr.responseText).message;
                        } catch (e) {}
                    }

                    this.set('errorMessage', message);
                    this.submitSpinner.stop();
                }
            }
        });
    },

    onFaxSent: function(data, textStatus, jqXHR) {
        this.store.pushPayload(data); // update available fax pages in the profile
        this.sendAction('faxSent');
        this.submitSpinner.stop();
        App.showNotification('We\'re sending your fax to ' + this.getInternationalNumber(true) + '.', true);
    },

    getNumberEl: function() {
        return $(this.get('numberField.element'));
    }
});
