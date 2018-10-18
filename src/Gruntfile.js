'use strict';

var fs = require('fs'),
    path = require('path');

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to match all subfolders:
// 'test/spec/**/*.js'

module.exports = function(grunt) {
    // load all grunt tasks
    require('load-grunt-tasks')(grunt);
    // show elapsed time at the end
    require('time-grunt')(grunt);

    var useminPatterns = require('usemin-patterns');

    // configurable paths
    var yeomanConfig = {
        app: require('./bower.json').appPath || 'client',
        dist: 'dist'
    };

    grunt.registerTask('cdnPrepare', function() {
        if (process.env.CDN_PATH) {
            grunt.task.run([
                'replace:cdn',
                'copy:pdfJsCdn',
                'ftp-deploy:cdn'
            ]);
        }
    });

    var pdfjsVersion = (function() {
        try {
            var str = fs.readFileSync(path.join(__dirname, 'client', 'bower_components', 'pdfjs-dist', 'bower.json'), 'utf8'),
                json = JSON.parse(str);

            return json.version;
        } catch (e) {
            throw new Error('Failed to get PDFJS version: ' + e);
        }
    })();

    grunt.initConfig({
        yeoman: yeomanConfig,
        cdnPath: process.env.CDN_PATH,
        pdfjsVersion: pdfjsVersion,
        replace: {
            cdn: {
                options: {
                    patterns: [
                        // get scripts, styles and images from cachefly CDN
                        {
                            match: /\/scripts\/([a-z0-9\.]+\.js)/g,
                            replacement: 'https://paperjet.cachefly.net/<%= cdnPath %>/scripts/$1'
                        }, {
                            match: /\/styles\/([a-z0-9\.]+\.css)/g,
                            replacement: 'https://paperjet.cachefly.net/<%= cdnPath %>/styles/$1'
                        }, {
                            match: /images\/web/g,
                            replacement: 'https://paperjet.cachefly.net/<%= cdnPath %>/images/web'
                        },
                        // get socket.io from cdnjs CDN
                        {
                            match: /\/socket\.io\/socket\.io\.js/g,
                            replacement: function() {
                                try {
                                    var str = fs.readFileSync(path.join(__dirname, 'node_modules', 'socket.io', 'package.json'), 'utf8'),
                                        json = JSON.parse(str);

                                    return 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/' + json.version + '/socket.io.js';
                                } catch (e) {
                                    console.error('Cannot find socket.io version');
                                    return '/socket.io/socket.io.js';
                                }
                            }
                        },
                        // set PDF.js metadata to cachefly CDN
                        {
                            match: /name="pdfjs-root", content=""/g,
                            replacement: 'name="pdfjs-root", content="https://paperjet.cachefly.net/<%= cdnPath %>"'
                        },
                        // get PDF.js from cachefly CDN. Note: version from bower.json is appended to the path
                        {
                            match: /\/scripts\/pdfjs/g,
                            replacement: 'https://paperjet.cachefly.net/<%= cdnPath %>/scripts/pdfjs'
                        }
                    ]
                },
                files: [{
                    expand: true,
                    flatten: true,
                    src: [
                        'dist/views/admin.jade',
                        'dist/views/dashboard.jade',
                        'dist/views/document.jade',
                        'dist/views/layout.jade'
                    ],
                    dest: 'dist/views/'
                }, {
                    expand: true,
                    flatten: true,
                    src: [
                        'dist/views/web/layout.jade',
                        'dist/views/web/footer.jade',
                        'dist/views/web/index.jade',
                        'dist/views/web/nav.jade'
                    ],
                    dest: 'dist/views/web/'
                }, {
                    expand: true,
                    flatten: true,
                    src: [
                        'dist/views/web/general/security.jade',
                        'dist/views/web/general/allangray-forms.jade'
                    ],
                    dest: 'dist/views/web/general/'
                }]
            }
        },
        'ftp-deploy': {
            cdn: {
                auth: {
                    host: 'ftp.cachefly.com',
                    port: 21,
                    authKey: 'key1',
                    authPath: 'cdn.ftppass'
                },
                src: 'dist',
                dest: '<%= cdnPath %>',
                forceVerbose: true,
                exclusions: ['views', 'vendor', '.htaccess']
            }
        },
        watch: {
            // files: ['app/**/*'],
            // options: {
            //     livereload: true
            // },
            emberTemplates: {
                files: '<%= yeoman.app %>/templates/**/*.hbs',
                tasks: ['emberTemplates']
            },
            neuter: {
                files: ['<%= yeoman.app %>/scripts/{,*/}*{,*/}*.js', '<%= yeoman.app %>/tests/{,*/}*{,*/}*.js'],
                tasks: ['neuter:dashboard', 'neuter:doc', 'neuter:admin', 'neuter:testDoc']
            },
            // coffee: {
            //     files: ['<%= yeoman.app %>/scripts/{,*/}*.coffee'],
            //     tasks: ['coffee']
            // },
            less: {
                files: ['<%= yeoman.app %>/styles/{,*/}*.less'],
                tasks: ['less:app']
            },
            gruntfile: {
                files: ['Gruntfile.js']
            },
            notify: {
                files: [
                    '<%= yeoman.app %>/templates/**/*.hbs',
                    '<%= yeoman.app %>/scripts/{,*/}*{,*/}*.js',
                    '<%= yeoman.app %>/styles/{,*/}*.less',
                    '<%= yeoman.app %>/tests/{,*/}*{,*/}*.js',
                    'Gruntfile.js'
                ],
                tasks: ['notify:watch']
            }
            // express: {
            //     files: ['app.js', '!**/node_modules/**', '!Gruntfile.js'],
            //     tasks: ['express:dev'],
            //     options: {
            //         nospawn: true // Without this option specified express won't be reloaded
            //     }
            // }
            // livereload: {
            //     options: {
            //         livereload: '<%= connect.options.livereload %>'
            //     },
            //     files: [
            //         '<%= yeoman.app %>/*.html',
            //         '{.tmp,<%= yeoman.app %>}/styles/{,*/}*.css',
            //         '{.tmp,<%= yeoman.app %>}/scripts/{,*/}*.js',
            //         '<%= yeoman.app %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
            //     ]
            // }
        },
        notify: {
            watch: {
                options: {
                    message: 'Client updated...'
                }
            },
            watchClient: {
                options: {
                    message: 'Started watching client...'
                }
            }
        },
        // connect: {
        //     options: {
        //         port: 9000,
        //         // change this to '0.0.0.0' to access the server from outside
        //         hostname: 'localhost',
        //         livereload: 35729
        //     },
        //     livereload: {
        //         options: {
        //             open: true,
        //             base: [
        //                 '.tmp',
        //                 '<%= yeoman.app %>'
        //             ]
        //         }
        //     },
        //     test: {
        //         options: {
        //             port: 9001,
        //             base: [
        //                 '.tmp',
        //                 'test',
        //                 '<%= yeoman.app %>'
        //             ]
        //         }
        //     },
        //     dist: {
        //         options: {
        //             base: '<%= yeoman.dist %>'
        //         }
        //     }
        // },
        clean: {
            dist: {
                files: [{
                    dot: true,
                    src: [
                        '.tmp',
                        '<%= yeoman.dist %>/*',
                        '!<%= yeoman.dist %>/.git*',
                        '.tmp/styles/dashboard.css',
                        '.tmp/styles/admin.css',
                        '.tmp/styles/document.css',
                        '.tmp/styles/vendor.css',
                        '.tmp/styles/web.css',
                        '.tmp/styles/main.css.map'
                    ]
                }]
            },
            server: '.tmp'
        },
        // jshint: {
        //     options: {
        //         jshintrc: '.jshintrc',
        //         reporter: require('jshint-stylish')
        //     },
        //     all: [
        //         // 'Gruntfile.js',
        //         '<%= yeoman.app %>/scripts/{,*/}*.js',
        //         '!<%= yeoman.app %>/scripts/vendor/*',
        //         'test/spec/{,*/}*.js'
        //     ]
        // },
        // mocha: {
        //     all: {
        //         options: {
        //             run: true,
        //             urls: ['http://localhost:<%= connect.options.port %>/dashboard.html']
        //         }
        //     }
        // },
        // coffee: {
        //     dist: {
        //         files: [{
        //             expand: true,
        //             cwd: '<%= yeoman.app %>/scripts',
        //             src: '{,*/}*.coffee',
        //             dest: '<%= yeoman.app %>/scripts',
        //             ext: '.js'
        //         }]
        //     }
        // },
        less: {
            app: {
                files: {
                    '.tmp/styles/dashboard.css': ['<%= yeoman.app %>/styles/dashboard.less'],
                    '.tmp/styles/document.css': ['<%= yeoman.app %>/styles/document.less'],
                    '.tmp/styles/admin.css': ['<%= yeoman.app %>/styles/admin.less'],
                    '.tmp/styles/web.css': ['<%= yeoman.app %>/styles/web.less']
                },
                options: {
                    sourceMap: true,
                    sourceMapBasepath: '/',
                    sourceMapRootpath: '/'
                }
            },
            dist: {
                files: {
                    '.tmp/styles/dashboard.css': ['<%= yeoman.app %>/styles/dashboard.less'],
                    '.tmp/styles/document.css': ['<%= yeoman.app %>/styles/document.less'],
                    '.tmp/styles/admin.css': ['<%= yeoman.app %>/styles/admin.less'],
                    '.tmp/styles/web.css': ['<%= yeoman.app %>/styles/web.less'],
                    '.tmp/styles/vendor.css': ['<%= yeoman.app %>/styles/vendor.less'] // TODO:
                },
                options: {
                    sourceMap: true,
                    sourceMapBasepath: '/',
                    sourceMapRootpath: '/'
                }
            }
        },
        // not used since Uglify task does concat,
        // but still available if needed
        /*concat: {
         dist: {}
         },*/
        // not enabled since usemin task does concat and uglify
        // check dashboard.html to edit your build targets
        // enable this task if you prefer defining your build targets here
        /*uglify: {
         dist: {}
         },*/
        rev: {
            dist: {
                files: {
                    src: [
                        '<%= yeoman.dist %>/scripts/{,*/}*.js',
                        '<%= yeoman.dist %>/styles/{,*/}*.css',
                        '<%= yeoman.dist %>/images/{,*/}*.{png,jpg,jpeg,gif,webp}',
                        '<%= yeoman.dist %>/fonts/{,*/}*.*'
                    ]
                }
            }
        },
        useminPrepare: {
            html: ['views/**/*.jade'],
            options: {
                dest: '<%= yeoman.dist %>',
                root: 'client'
                    // ,
                    // assetsDirs: ['<%= yeoman.dist %>/**/']
            }
        },
        usemin: {
            jade: ['<%= yeoman.dist %>/**/*.jade'],
            html: ['<%= yeoman.dist %>/{,*/}*.html', '<%= yeoman.dist %>/**/*.jade'],
            css: ['<%= yeoman.dist %>/styles/{,*/}*.css'],
            js: ['<%= yeoman.dist %>/scripts/**/*.js'],
            options: {
                // dirs: ['<%= yeoman.dist %>/**/']
                // ,
                assetsDirs: ['<%= yeoman.dist %>/**/'],
                patterns: {
                    jade: useminPatterns.jade,
                    js: [
                        [/(user-profile\.png)/g, 'Replacing reference to user-profile.png'],
                        [/(stripe-logo\.png)/g, 'Replacing reference to stripe-logo.png'],
                        [/(check-square-o_000000_512\.png)/g, 'Replacing reference to check-square-o_000000_512.png'],
                        [/(check-square-o_0000ff_512\.png)/g, 'Replacing reference to check-square-o_0000ff_512.png'],
                        [/(check-square-o_00ff00_512\.png)/g, 'Replacing reference to check-square-o_00ff00_512.png'],
                        [/(check-square-o_ff0000_512\.png)/g, 'Replacing reference to check-square-o_ff0000_512.png'],
                        [/(check-square-o_ff00ff_512\.png)/g, 'Replacing reference to check-square-o_ff00ff_512.png'],
                        [/(check-square-o_ffffff_512\.png)/g, 'Replacing reference to check-square-o_ffffff_512.png'],
                        [/\"(square-o_000000_512\.png)/g, 'Replacing reference to square-o_000000_512.png'],
                        [/\"(square-o_0000ff_512\.png)/g, 'Replacing reference to square-o_0000ff_512.png'],
                        [/\"(square-o_00ff00_512\.png)/g, 'Replacing reference to square-o_00ff00_512.png'],
                        [/\"(square-o_ff0000_512\.png)/g, 'Replacing reference to square-o_ff0000_512.png'],
                        [/\"(square-o_ff00ff_512\.png)/g, 'Replacing reference to square-o_ff00ff_512.png'],
                        [/\"(square-o_ffffff_512\.png)/g, 'Replacing reference to square-o_ffffff_512.png'],
                        [/\"(signature-request1\.png)/g, 'Replacing reference to signature-request1.png'],
                        [/\"(initials-request1\.png)/g, 'Replacing reference to initials-request1.png'],
                        [/\"(signature-request2\.png)/g, 'Replacing reference to signature-request2.png'],
                        [/\"(initials-request2\.png)/g, 'Replacing reference to initials-request2.png']
                    ]
                }
            }
        },
        imagemin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.app %>/images',
                    src: '{,*/}*.{png,jpg,jpeg}',
                    dest: '<%= yeoman.dist %>/images'
                }]
            }
        },
        svgmin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.app %>/images',
                    src: '{,*/}*.svg',
                    dest: '<%= yeoman.dist %>/images'
                }]
            }
        },
        cssmin: {
            dist: {
                files: {
                    '<%= yeoman.dist %>/styles/dashboard.css': [
                        '.tmp/styles/dashboard.css'
                    ],
                    '<%= yeoman.dist %>/styles/document.css': [
                        '.tmp/styles/document.css'
                    ],
                    '<%= yeoman.dist %>/styles/admin.css': [
                        '.tmp/styles/admin.css'
                    ],
                    '<%= yeoman.dist %>/styles/vendor.css': [
                        '.tmp/styles/vendor.css'
                    ],
                    '<%= yeoman.dist %>/styles/web.css': [
                        '.tmp/styles/web.css'
                    ]
                }
            }
        },
        htmlmin: {
            dist: {
                options: {
                    /*removeCommentsFromCDATA: true,
                     // https://github.com/yeoman/grunt-usemin/issues/44
                     //collapseWhitespace: true,
                     collapseBooleanAttributes: true,
                     removeAttributeQuotes: true,
                     removeRedundantAttributes: true,
                     useShortDoctype: true,
                     removeEmptyAttributes: true,
                     removeOptionalTags: true*/
                },
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.app %>',
                    src: '*.html',
                    dest: '<%= yeoman.dist %>'
                }]
            }
        },
        copy: {
            dist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>',
                    dest: '<%= yeoman.dist %>',
                    src: [
                        '*.{ico,png,txt}',
                        'fonts/{,*/}*.*',
                        'vendor/{,*/}*.*',
                        '.htaccess',
                        'images/{,*/}*.{webp,gif}'
                    ]
                }, {
                    expand: true,
                    dot: true,
                    cwd: 'views',
                    dest: '<%= yeoman.dist %>/views',
                    src: ['**/*']
                }]
            },
            devCopyDist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>',
                    dest: '<%= yeoman.dist %>',
                    src: [
                        '*.{ico,png,txt}',
                        'fonts/{,*/}*.*',
                        'vendor/{,*/}*.*',
                        '.htaccess',
                        'images/{,*/}*.*',
                        'scripts/{,*/}*.*'
                    ]
                }, {
                    expand: true,
                    dot: true,
                    cwd: 'views',
                    dest: '<%= yeoman.dist %>/views',
                    src: ['**/*']
                }]
            },
            server: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/font-awesome/fonts/',
                    dest: '<%= yeoman.app %>/fonts/font-awesome',
                    src: ['*']
                }, {
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/bootstrap/fonts/',
                    dest: '<%= yeoman.app %>/fonts/glyphicons',
                    src: ['*']
                }]
            },
            pdfJsDist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/pdfjs-dist/',
                    dest: '<%= yeoman.dist %>/scripts/pdfjs',
                    src: ['**']
                }, {
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/bootstrap/fonts/',
                    dest: '<%= yeoman.dist %>/fonts/glyphicons',
                    src: ['*']
                }]
            },
            pdfJsCdn: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/pdfjs-dist/',
                    dest: '<%= yeoman.dist %>/scripts/pdfjs<%= pdfjsVersion %>',
                    src: ['**']
                }]
            },
            serverDist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/font-awesome/fonts/',
                    dest: '<%= yeoman.dist %>/fonts/font-awesome',
                    src: ['*']
                }, {
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/bootstrap/fonts/',
                    dest: '<%= yeoman.dist %>/fonts/glyphicons',
                    src: ['*']
                }]
            },
            // TODO: better to keep these images in bower_components
            jqueryui: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/jquery-ui/themes/base/images',
                    dest: '.tmp/styles/images',
                    src: ['*']
                }]
            },
            jqueryuiDist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/jquery-ui/themes/base/images',
                    dest: '<%= yeoman.dist %>/styles/images',
                    src: ['*']
                }]
            },
            flagImage: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/intl-tel-input/build/img',
                    dest: '.tmp/styles/images',
                    src: ['*']
                }]
            },
            flagImageDist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: '<%= yeoman.app %>/bower_components/intl-tel-input/build/img',
                    dest: '<%= yeoman.dist %>/styles/images',
                    src: ['*']
                }]
            },
            tmpDist: {
                files: [{
                    expand: true,
                    cwd: '.tmp/',
                    dest: '<%= yeoman.dist %>',
                    src: ['**']
                }]
            }
        },
        concurrent: {
            dist: [
                // 'coffee',
                'less',
                'imagemin',
                'svgmin',
                'htmlmin'
            ]
        },
        emberTemplates: {
            options: {
                templateName: function(sourceFile) {
                    var templatePathDash = yeomanConfig.app + '/templates/dashboard/',
                        templatePathDoc = yeomanConfig.app + '/templates/document/',
                        templatePathAdmin = yeomanConfig.app + '/templates/admin/',
                        templatePathComp = yeomanConfig.app + '/templates/components/',
                        templatePathViews = yeomanConfig.app + '/templates/views/';

                    return sourceFile.replace(templatePathAdmin, '').replace(templatePathDoc, '').replace(templatePathDash, '').replace(templatePathComp, 'components/').replace(templatePathViews, 'views/');
                },
                templateCompilerPath: 'client/bower_components/ember/ember-template-compiler.js',
                handlebarsPath: 'client/bower_components/handlebars/handlebars.js'
            },
            app: {
                files: {
                    '.tmp/scripts/dashboard.templates.js': [
                        '<%= yeoman.app %>/templates/dashboard/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/components/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/views/{,*/}*.hbs'
                    ],
                    '.tmp/scripts/document.templates.js': [
                        '<%= yeoman.app %>/templates/document/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/components/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/views/{,*/}*.hbs'
                    ],
                    '.tmp/scripts/admin.templates.js': [
                        '<%= yeoman.app %>/templates/admin/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/components/{,*/}*.hbs',
                        '<%= yeoman.app %>/templates/views/{,*/}*.hbs'
                    ]
                }
            }
        },
        neuter: {
            dashboard: {
                options: {
                    filepathTransform: function(filepath) {
                        return yeomanConfig.app + '/' + filepath;
                    }
                },
                src: '<%= yeoman.app %>/scripts/dashboard/app.js',
                dest: '.tmp/scripts/dashboard.app.js'
            },
            doc: {
                options: {
                    filepathTransform: function(filepath) {
                        return yeomanConfig.app + '/' + filepath;
                    }
                },
                src: '<%= yeoman.app %>/scripts/document/app.js',
                dest: '.tmp/scripts/document.app.js'
            },
            admin: {
                options: {
                    filepathTransform: function(filepath) {
                        return yeomanConfig.app + '/' + filepath;
                    }
                },
                src: '<%= yeoman.app %>/scripts/admin/app.js',
                dest: '.tmp/scripts/admin.app.js'
            },
            testDoc: {
                options: {
                    filepathTransform: function(filepath) {
                        return yeomanConfig.app + '/' + filepath;
                    }
                },
                src: '<%= yeoman.app %>/tests/document/tests.js',
                dest: '.tmp/tests/document/tests.js'
            }
        },
        // Express Config
        express: {
            options: {
                // Override defaults here
            },
            dev: {
                options: {
                    script: 'app.js'
                }
            }
        },
        testem: {
            doc: {
                src: [
                    'client/bower_components/jquery/dist/jquery.js',
                    'client/bower_components/handlebars/handlebars.runtime.js',
                    'client/bower_components/ember/ember.js',
                    'client/bower_components/ember-data/ember-data.js',
                    'client/bower_components/lodash/lodash.js',

                    'client/bower_components/bootstrap/js/affix.js',
                    'client/bower_components/bootstrap/js/alert.js',
                    'client/bower_components/bootstrap/js/dropdown.js',
                    'client/bower_components/bootstrap/js/tooltip.js',
                    'client/bower_components/bootstrap/js/modal.js',
                    'client/bower_components/bootstrap/js/transition.js',
                    'client/bower_components/bootstrap/js/button.js',
                    'client/bower_components/bootstrap/js/popover.js',
                    'client/bower_components/bootstrap/js/carousel.js',
                    'client/bower_components/bootstrap/js/scrollspy.js',
                    'client/bower_components/bootstrap/js/collapse.js',
                    'client/bower_components/bootstrap/js/tab.js',

                    'client/bower_components/ladda/js/spin.js',
                    'client/bower_components/ladda/js/ladda.js',

                    'client/bower_components/moment/moment.js',

                    'client/bower_components/jquery-bootpag/lib/jquery.bootpag.js',

                    'client/bower_components/pdfjs-dist/compatibility.js',
                    'client/bower_components/pdfjs-dist/pdf.js',

                    'client/bower_components/ember-qunit/dist/globals/main.js',

                    // '.tmp/scripts/dashboard.app.js',
                    '.tmp/scripts/document.app.js',
                    // '.tmp/scripts/dashboard.templates.js',
                    '.tmp/scripts/document.templates.js',

                    '.tmp/tests/document/tests.js'
                ],
                options: {
                    parallel: 2,
                    framework: 'qunit',
                    launch_in_dev: ['PhantomJS'],
                    launch_in_ci: ['PhantomJS']
                }
            }
        }
    });

    grunt.registerTask('serve', function(target) {
        if (target === 'dist') {
            return grunt.task.run(['build', 'connect:dist:keepalive']);
        }

        grunt.task.run([
            'clean:server',
            // 'coffee',
            'emberTemplates',
            'neuter:doc',
            'neuter:dashboard',
            'neuter:admin',
            'less',
            'copy:server',
            // 'connect:livereload',
            'express:dev',
            'watch'
        ]);
    });

    // grunt.registerTask('server', function() {
    //     grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
    //     grunt.task.run(['serve']);
    // });

    // grunt.registerTask('test', [
    //     'clean:server',
    //     // 'coffee',
    //     'less',
    //     'copy:server',
    //     'connect:test',
    //     'neuter:app'
    //     // 'mocha'
    // ]);
    grunt.registerTask('dev', [
        'clean:dist',
        'emberTemplates',
        'neuter:doc',
        'neuter:dashboard',
        'neuter:admin',
        'less',
        'copy:devCopyDist',
        'copy:serverDist',
        'copy:jqueryuiDist',
        'copy:flagImageDist',
        'copy:tmpDist',
        'copy:pdfJsDist'
    ]);

    grunt.registerTask('watchClient', [
        'clean:server',
        // 'coffee',
        'emberTemplates',
        'neuter:doc',
        'neuter:dashboard',
        'neuter:admin',
        'neuter:testDoc',
        'less',
        'copy:server',
        'copy:jqueryui',
        'copy:flagImage',
        // 'connect:livereload',
        // 'express:dev',
        'notify:watchClient',
        'watch'
    ]);

    grunt.registerTask('build', [
        'clean:dist',
        'copy:server',
        'useminPrepare',
        'concurrent',
        'emberTemplates',
        'cssmin',
        'neuter:doc',
        'neuter:dashboard',
        'neuter:admin',
        'concat',
        'uglify',
        'copy:dist',
        'copy:jqueryuiDist',
        'copy:flagImageDist',
        'rev',
        'usemin',
        'cdnPrepare'
    ]);

    grunt.registerTask('default', [
        // 'jshint',
        // 'test',
        'build'
    ]);

    grunt.registerTask('test', [
        'clean:server',
        'emberTemplates',
        'neuter:doc',
        'neuter:dashboard',
        'neuter:admin',
        'neuter:testDoc',
        'copy:server',
        'testem:ci:doc'
    ]);
};
