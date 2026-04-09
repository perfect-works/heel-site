(function () {

    /* ─── upcoming shows (Google Sheets CSV) ──────────────── */
    var SHOWS = [];
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTPfMXHrmoomviVZrQvEWcSvwWsWLvFh96HAChufRtqNPVpDEc7qFNJJk--T2RQmouUG9OA71rQDH6_/pub?output=csv')
        .then(function (r) { return r.text(); })
        .then(function (csv) {
            var lines = csv.trim().split('\n').slice(1);
            SHOWS = lines.map(function (line) {
                var cols = line.split(',');
                return {
                    date:  (cols[0] || '').trim(),
                    city:  (cols[1] || '').trim(),
                    venue: (cols[2] || '').trim(),
                    href:  (cols[3] || '').trim()
                };
            }).filter(function (s) { return s.date; });
        })
        .catch(function () { /* shows stay empty */ });

    /* ─── visitor count (GoatCounter) ─────────────────────── */
    var visitorCount = null;
    fetch('https://heel.goatcounter.com/counter/%2F.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            visitorCount = (data.count && /\d/.test(data.count)) ? data.count : null;
            var tray = document.getElementById('visitor-count-tray');
            if (tray && visitorCount) {
                tray.textContent = visitorCount + ' visits';
            }
        })
        .catch(function () { visitorCount = null; });

    var output         = document.getElementById('output');
    var input          = document.getElementById('cmd');
    var inputRow       = document.getElementById('input-row');
    var terminal       = document.getElementById('terminal');
    var desktopIconsEl = document.getElementById('desktop-icons');

    var cmdHistory       = [];
    var historyPos       = -1;
    var updateExplorerState = function () {}; // assigned after explorer init
    var animating        = false;
    var currentDir       = 'root';
    var currentAudio       = null;
    var audioPaused        = false;
    var masterVolume       = 1;
    var masterMuted        = false;
    var nowPlayingInterval = null;
    var printGeneration    = 0;
    var tabCycle = { partial: null, matches: [], index: -1 };

    var ytApiReady        = false;
    var ytPlayer          = null;
    var vlcUpdateIv       = null;
    var vlcPendingId      = null;
    var vlcPendingTitle   = null;
    var vlcMinimized      = false;
    var vlcTaskBtn        = null;
    var vlcWindowEl       = null; // assigned after DOM refs below

    var currentTrackLabel   = null;
    var playerTrackList     = [];
    var playerTrackIndex    = -1;
    var playerCurrentAlbum  = 'segmentation';
    var playerUpdateIv      = null;
    var playerMinimized     = false;

    /* ── member registry ── */
    var MEMBERS = {
        'adharsh': { 
            instrument: 'guitar / vocals', 
            profile: '22 years old. born in cedar rapids, iowa. avid computer scientist. ', 
            gear: 'guitar: squier jazzmaster\namp: peavey stereo chorus 212\npedal: memory man',
            photo: 'images/users/adharsh/adharsh_rajavel.png', 
            data: 'music: chief keef, medicine, tagabow\nmovies: sexy beast, snatch, and all movies with that one guy in it\n',
            photoName: 'adharsh_rajavel.png'   
        },
        'tayla': { 
            instrument: 'guitar / vocals', 
            profile: 'gemini. from new braunfels, tx. surf gang fangirl, big enjoyer of urban planning, loves her dog named bruno.', 
            gear: 'guitar: epiphone sg\namp: orange supercrush 100\ncab: line6 4x12',
            photo: 'images/users/tayla/tayla_diza.png',
            data: 'movies: gummo, the royal tenenbaums\ncolors: pink, orange, red, purple\nplaces: nearest body of water',
            photoName: 'tayla_diza.png'
        },
        'nick': { 
            instrument: 'bass',
            profile: '22 years old. round rock born and raised. fan of long walks in urban and non-urban areas, posting instagram story collages, and the lesser known rage game pogostuck.',
            photo: 'images/users/nick/nicholas_dienstbier.png',  
            photoName: 'nicholas_dienstbier.png'
        },
        'andres':  { 
            instrument: 'drums',
            profile: '22 years old. spent his formative years in the california high desert before arriving in texas at the age of 14. just plays the drums. in the spaces between heel shows he spends his time playing overwatch and inbetween playing overwatch he spends his time studying ocean engineering.', 
            gear: 'kit: tama imperialstar\nhi-hat: zildijan new beats\nride: paiste power ride\nsticks: promark hickory 5b', 
            data: 'music: the beach boys, roly poly rag bear, bloodthirsty butchers\nmovies: love exposure\nbooks: childhood\'s end, dune\ngames: ocarina of time, xenogears\nfood: in n out burger\nplaces: seaside, bed', 
            photo: 'images/users/andres/andres_gonzalez.png',    
            photoName: 'andres_gonzalez.png'    
        },
    };

    /* ── merch registry ── */
    var MERCH = [
        { id: 'obey_tshirt',           label: 'obey_tshirt', href: 'https://heelband.bandcamp.com/merch/obey',                          price: '$20', photo: 'images/merch/obey_shirt.png'    },
        { id: 'segmentation_cd',       label: 'cd',       href: 'https://heelband.bandcamp.com/album/segmentation',                  price: '$13', photo: 'images/merch/cd.png'            },
        { id: 'segmentation_cassette', label: 'cassette', href: 'https://heelband.bandcamp.com/album/segmentation',                  price: '$11', photo: 'images/merch/cassette.png'      },
        { id: 'bumper',                label: 'bumper sticker', href: 'https://heelband.bandcamp.com/merch/heaven-or-heel-bumper-sticker', price: '$5',  photo: 'images/merch/bumpersticker.png' },
        { id: 'zine',                  label: 'zine',     href: 'https://heelband.bandcamp.com/merch/heel-zine',                       price: '$14', photo: 'images/merch/zine.png', samples: ['images/merch/zine/sample1.png', 'images/merch/zine/sample2.png'] },
        { id: 'bundle',                label: 'sticker bundle', href: 'https://heelband.bandcamp.com/merch/heel-sticker-pack',          price: '$6',  photo: 'images/merch/sticker_bundle.png' },
    ];

    /* label → id map for short-name cd navigation (e.g. 'cd' → 'segmentation_cd') */
    var MERCH_LABEL_MAP = {};
    for (var _mi = 0; _mi < MERCH.length; _mi++) {
        if (MERCH[_mi].label && MERCH[_mi].label !== MERCH[_mi].id)
            MERCH_LABEL_MAP[MERCH[_mi].label] = MERCH[_mi].id;
    }

    function getMerchItem(id) {
        for (var i = 0; i < MERCH.length; i++) {
            if (MERCH[i].id === id) return MERCH[i];
        }
        return null;
    }

    /* ── track registry — fill in file paths once audio/ is populated ── */
    var TRACKS = {
        segmentation: [
            { id: 'segmentation',       label: '01 - segmentation',       file: 'sounds/music/segmentation/01_segmentation.mp3'     },
            { id: 'stare',              label: '02 - stare',              file: 'sounds/music/segmentation/02_stare.mp3',             lyricsFile: '02_stare.txt'              },
            { id: 'august',             label: '03 - august',             file: 'sounds/music/segmentation/03_august.mp3',            lyricsFile: '03_august.txt'             },
            { id: 'through me',         label: '04 - through me',         file: 'sounds/music/segmentation/04_through_me.mp3',        lyricsFile: '04_through_me.txt'         },
            { id: 'daisy chain',        label: '05 - daisy chain',        file: 'sounds/music/segmentation/05_daisy_chain.mp3',       lyricsFile: '05_daisy_chain.txt'        },
            { id: 'some other memory',  label: '06 - some other memory',  file: 'sounds/music/segmentation/06_some_other_memory.mp3', lyricsFile: '06_some_other_memory.txt'  },
            { id: 'waste',              label: '07 - waste',              file: 'sounds/music/segmentation/07_waste.mp3',             lyricsFile: '07_waste.txt'              },
            { id: "you're so far away", label: "08 - you're so far away", file: 'sounds/music/segmentation/08_youre_so_far_away.mp3', lyricsFile: '08_ysfa.txt'               },
            { id: 'in my way',          label: '09 - in my way',          file: 'sounds/music/segmentation/09_in_my_way.mp3',         lyricsFile: '09_in_my_way.txt'          },
            { id: 'honeycomb',          label: '10 - honeycomb',          file: 'sounds/music/segmentation/10_honeycomb.mp3',         lyricsFile: '10_honeycomb.txt'          },
        ],
        unreleased: [],
        sgmt_demos: [],
        heel2_demos: [],
    };

    fetch('sounds/music/manifest.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            function toTracks(files, dir) {
                return files.map(function (file) {
                    var id = file.replace(/\.mp3$/i, '');
                    return { id: id, label: id, file: 'sounds/music/unreleased/' + dir + '/' + file };
                });
            }
            TRACKS.sgmt_demos  = toTracks(data.sgmt_demos  || [], 'segmentation');
            TRACKS.heel2_demos = toTracks(data.heel2_demos || [], 'heel2');
        })
        .catch(function () { /* manifest unavailable, demo lists stay empty */ });

    /* ── photo registry (populated from manifest.json) ── */
    var PHOTOS = [];
    fetch('images/photo/manifest.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var photos = (data.photos || []).map(function (file) {
                return {
                    id:  file.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '_'),
                    file: file,
                    src:  'images/photo/' + file
                };
            });
            var wallpapers = (data.wallpapers || []).map(function (file) {
                return {
                    id:  file.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '_'),
                    file: file,
                    src:  'images/photo/wallpapers/' + file,
                    dir:  'wallpapers'
                };
            });
            wallpapers.unshift({ id: 'blue', file: 'blue.png', src: null, dir: 'wallpapers' });
            PHOTOS = photos.concat(wallpapers);
        })
        .catch(function () { /* manifest unavailable, photo viewer will be empty */ });

    /* ── video registry ── */
    var VIDEOS = [
        { id: 'launch_show',           file: 'launch_show.avi',           href: 'https://www.youtube.com/watch?v=0BCGjLoA6uc' },
        { id: 'honeycomb_vis',         file: 'honeycomb_vis.avi',         href: 'https://www.youtube.com/watch?v=JAfxkuAhK0c' },
        { id: 'through_me_vis',        file: 'through_me_vis.avi',        href: 'https://youtu.be/v5sKosUJGIw'                 },
        { id: 'youre_so_far_away_vis', file: 'youre_so_far_away_vis.avi', href: 'https://www.youtube.com/watch?v=Jyj_q3xwDWA' },
    ];

    /* ── valid children per directory ── */
    var DIR_CHILDREN = {
        'root':               ['users', 'photo', 'video', 'music', 'merch'],
        'photo':              ['wallpapers'],
        'wallpapers':         [],
        'users':              ['adharsh', 'tayla', 'nick', 'andres'],
        'music':              ['segmentation', 'unreleased'],
        'merch':              ['obey_tshirt', 'segmentation', 'stickers', 'zine', 'bumper', 'bundle'],
        'merch/stickers':     ['bumper', 'bundle'],
        'music/segmentation': [],
        'music/unreleased':   ['sgmt_demos', 'heel2_demos'],
        'sgmt_demos':         [],
        'heel2_demos':        [],
        'merch/segmentation': ['segmentation_cd', 'segmentation_cassette', 'cd', 'cassette'],
        'adharsh':            [],
        'tayla':              [],
        'nick':               [],
        'andres':             [],
        'obey_tshirt':            [],
        'segmentation_cd':        [],
        'segmentation_cassette':  [],
        'bumper':                 [],
        'bundle':                 [],
    };

    /* ── parent directory map ── */
    var DIR_PARENTS = {
        'users':              'root',
        'video':              'root',
        'photo':              'root',
        'wallpapers':         'photo',
        'music':              'root',
        'merch':              'root',
        'music/segmentation':  'music',
        'music/unreleased':    'music',
        'sgmt_demos':          'music/unreleased',
        'heel2_demos':         'music/unreleased',
        'adharsh':            'users',
        'tayla':              'users',
        'nick':               'users',
        'andres':             'users',
        'merch/segmentation': 'merch',
        'obey_tshirt':            'merch',
        'segmentation_cd':        'merch/segmentation',
        'segmentation_cassette':  'merch/segmentation',
        'bumper':                 'merch/stickers',
        'bundle':                 'merch/stickers',
        'zine':                   'merch',
        'merch/stickers':         'merch',
    };

    /* load YouTube IFrame API */
    (function () {
        var s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
    }());

    window.onYouTubeIframeAPIReady = function () {
        ytApiReady = true;
        if (vlcPendingId) {
            vlcCreatePlayer(vlcPendingId, vlcPendingTitle);
            vlcPendingId    = null;
            vlcPendingTitle = null;
        }
    };

    function flashResolve(el, prefix, resolvedHTML, cb) {
        var s = '<span style="display:inline-block;width:3ch;text-align:center">';
        var frames = ['[' + s + '.</span>]', '[' + s + '..</span>]', '[' + s + '...</span>]'];
        var fi = 0;
        var maxCycles = 1 + Math.floor(Math.random() * 2);
        var cycles = 0;
        el.innerHTML = prefix + ' ' + frames[0];
        var iv = setInterval(function () {
            fi = (fi + 1) % frames.length;
            if (fi === 0) cycles++;
            if (cycles >= maxCycles) {
                clearInterval(iv);
                el.innerHTML = resolvedHTML;
                if (cb) cb();
            } else {
                el.innerHTML = prefix + ' ' + frames[fi];
            }
        }, 250);
    }

    function promptPath() {
        if (currentDir === 'root')               return 'C:\\heel';
        if (currentDir === 'users')              return 'C:\\heel\\users';
        if (currentDir === 'music')              return 'C:\\heel\\music';
        if (currentDir === 'music/segmentation') return 'C:\\heel\\music\\segmentation';
        if (currentDir === 'music/unreleased')   return 'C:\\heel\\music\\unreleased';
        if (currentDir === 'sgmt_demos')  return 'C:\\heel\\music\\unreleased\\sgmt_demos';
        if (currentDir === 'heel2_demos') return 'C:\\heel\\music\\unreleased\\heel2_demos';
        if (currentDir === 'video')             return 'C:\\heel\\video';
        if (currentDir === 'photo')             return 'C:\\heel\\photo';
        if (currentDir === 'wallpapers')        return 'C:\\heel\\photo\\wallpapers';
        if (currentDir === 'merch')              return 'C:\\heel\\merch';
        if (currentDir === 'merch/segmentation') return 'C:\\heel\\merch\\segmentation';
        if (currentDir === 'merch/stickers')    return 'C:\\heel\\merch\\stickers';
        if (getMerchItem(currentDir)) {
            var mitem2 = getMerchItem(currentDir);
            var mlabel = mitem2.label || currentDir;
            var mpar = DIR_PARENTS[currentDir];
            if (mpar === 'merch/segmentation') return 'C:\\heel\\merch\\segmentation\\' + mlabel;
            if (mpar === 'merch/stickers')     return 'C:\\heel\\merch\\stickers\\' + currentDir;
            return 'C:\\heel\\merch\\' + mlabel;
        }
        return 'C:\\heel\\users\\' + currentDir;
    }
    function promptHTML() {
        var path = promptPath();
        var limit = window.innerWidth <= 500 ? 18 : 38;
        if (path.length > limit) {
            path = '\u2026' + path.slice(path.length - (limit - 1));
        }
        return 'PS&nbsp;' + path + '&gt;&nbsp;';
    }
    function updatePrompt() {
        document.querySelector('#input-row .prompt-prefix').innerHTML = promptHTML();
        if (desktopIconsEl) updateDesktopIcons();
        updateExplorerState();
    }

    function tc(indent, last) {
        var pad = '';
        for (var i = 0; i < indent; i++) pad += '&nbsp;&nbsp;&nbsp;&nbsp;';
        return '<span class="tree-char">' + pad + (last ? '└── ' : '├── ') + '</span>';
    }
    // sub-item under a non-last parent: shows │ continuation line
    function tcsub(last) {
        return '<span class="tree-char">│&nbsp;&nbsp;&nbsp;' + (last ? '└── ' : '├── ') + '</span>';
    }

    function dirListing() {
        var lines = [{ t: 'blank' }];

        if (currentDir === 'root') {
            lines.push({ t: 'text', v: 'C:\\heel\\' });
            lines.push({ t: 'dirlink', label: tc(0, false) + '[users]',    cmd: 'cd users'      });
            lines.push({ t: 'dirlink', label: tc(0, false) + '[photo]',    cmd: 'cd photo'      });
            lines.push({ t: 'dirlink', label: tc(0, false) + '[video]',    cmd: 'cd video'      });
            lines.push({ t: 'dirlink', label: tc(0, false) + '[music]',    cmd: 'cd music'      });
            lines.push({ t: 'dirlink', label: tc(0, false) + '[merch]',    cmd: 'cd merch'      });
            lines.push({ t: 'dirlink', label: tc(0, true)  + 'about.txt', cmd: 'cat about.txt' });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a folder or type 'cd &lt;dir&gt;'", dim: true });

        } else if (currentDir === 'users') {
            lines.push({ t: 'text', v: 'C:\\heel\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'users\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[adharsh]', cmd: 'cd adharsh' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[andres]',  cmd: 'cd andres'  });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[nick]',    cmd: 'cd nick'    });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[tayla]',   cmd: 'cd tayla'   });
            lines.push({ t: 'dirlink', label: tc(1, true)  + '[<- back]', cmd: 'cd ..'      });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a folder or type 'cd &lt;dir&gt;'", dim: true });

        } else if (currentDir === 'music') {
            lines.push({ t: 'text', v: 'C:\\heel\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'music\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[segmentation]', cmd: 'cd segmentation' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[unreleased]',    cmd: 'cd unreleased'   });
            lines.push({ t: 'dirlink', label: tc(1, false) + 'README.txt',     cmd: 'cat readme.txt'  });
            lines.push({ t: 'dirlink', label: tc(1, true)  + '[<- back]',          cmd: 'cd ..'           });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click README.txt or type 'cat readme.txt' for player info", dim: true });

        } else if (currentDir === 'music/segmentation') {
            var tracks = TRACKS.segmentation;
            lines.push({ t: 'text', v: 'C:\\heel\\music\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'segmentation\\' });
            for (var i = 0; i < tracks.length; i++) {
                lines.push({ t: 'dirlink',
                    label: tc(1, false) + tracks[i].label + '.mp3',
                    cmd:   'play ' + tracks[i].id });
            }
            if (!tracks.length) lines.push({ t: 'text', v: tc(1, false) + '(empty)', dim: true });
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });

        } else if (currentDir === 'music/unreleased') {
            lines.push({ t: 'text', v: 'C:\\heel\\music\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'unreleased\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[sgmt_demos]',    cmd: 'cd sgmt_demos'     });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[heel2_demos]',   cmd: 'cd heel2_demos'    });
            lines.push({ t: 'dirlink', label: tc(1, true)  + '[<- back]',       cmd: 'cd ..'             });

        } else if (currentDir === 'sgmt_demos') {
            var sdTracks = TRACKS.sgmt_demos;
            lines.push({ t: 'text', v: 'C:\\heel\\music\\unreleased\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'sgmt_demos\\' });
            for (var i = 0; i < sdTracks.length; i++) {
                lines.push({ t: 'dirlink',
                    label: tc(1, false) + sdTracks[i].label + '.mp3',
                    cmd:   'play ' + sdTracks[i].id });
            }
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });

        } else if (currentDir === 'heel2_demos') {
            var h2Tracks = TRACKS.heel2_demos;
            lines.push({ t: 'text', v: 'C:\\heel\\music\\unreleased\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'heel2_demos\\' });
            for (var i = 0; i < h2Tracks.length; i++) {
                lines.push({ t: 'dirlink',
                    label: tc(1, false) + h2Tracks[i].label + '.mp3',
                    cmd:   'play ' + h2Tracks[i].id });
            }
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });

        } else if (currentDir === 'video') {
            lines.push({ t: 'text', v: 'C:\\heel\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'video\\' });
            for (var vi = 0; vi < VIDEOS.length; vi++) {
                lines.push({ t: 'link', label: tc(1, false) + VIDEOS[vi].file, href: VIDEOS[vi].href, vlcId: extractYouTubeId(VIDEOS[vi].href), vlcTitle: VIDEOS[vi].id });
            }
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a file or type './&lt;file&gt;' to open", dim: true });

        } else if (currentDir === 'photo') {
            var rootPhotos = PHOTOS.filter(function (p) { return !p.dir; });
            lines.push({ t: 'text', v: 'C:\\heel\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'photo\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[wallpapers]', cmd: 'cd wallpapers' });
            for (var pi = 0; pi < rootPhotos.length; pi++) {
                lines.push({ t: 'dirlink', label: tc(1, false) + rootPhotos[pi].file, cmd: './' + rootPhotos[pi].file });
            }
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a file or type './&lt;file&gt;' to open", dim: true });

        } else if (currentDir === 'wallpapers') {
            var wpPhotos = PHOTOS.filter(function (p) { return p.dir === 'wallpapers'; });
            lines.push({ t: 'text', v: 'C:\\heel\\photo\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'wallpapers\\' });
            for (var wi = 0; wi < wpPhotos.length; wi++) {
                lines.push({ t: 'dirlink', label: tc(1, false) + wpPhotos[wi].file, cmd: './' + wpPhotos[wi].file });
            }
            if (!wpPhotos.length) lines.push({ t: 'text', v: tc(1, false) + '(empty)', dim: true });
            lines.push({ t: 'dirlink', label: tc(1, true) + '[<- back]', cmd: 'cd ..' });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "type './&lt;file&gt;' to set wallpaper", dim: true });

        } else if (currentDir === 'merch') {
            lines.push({ t: 'text', v: 'C:\\heel\\merch\\' });
            lines.push({ t: 'dirlink', label: tc(0, false)    + '[obey_tshirt]',  cmd: 'cd obey_tshirt'  });
            lines.push({ t: 'dirlink', label: tc(0, false)    + '[segmentation]', cmd: 'cd segmentation' });
            lines.push({ t: 'dirlink', label: tcsub(false)    + '[cd]',           cmd: 'cd cd'           });
            lines.push({ t: 'dirlink', label: tcsub(true)     + '[cassette]',     cmd: 'cd cassette'     });
            lines.push({ t: 'dirlink', label: tc(0, false)    + '[stickers]',     cmd: 'cd stickers'     });
            lines.push({ t: 'dirlink', label: tcsub(false)    + '[bumper]',  cmd: 'cd bumper'  });
            lines.push({ t: 'dirlink', label: tcsub(true)     + '[bundle]',  cmd: 'cd bundle'  });
            lines.push({ t: 'dirlink', label: tc(0, false)    + '[zine]',           cmd: 'cd zine'       });
            lines.push({ t: 'dirlink', label: tc(0, true)     + '[<- back]',        cmd: 'cd ..'         });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click an item or type 'cd &lt;item&gt;' to view", dim: true });

        } else if (currentDir === 'merch/stickers') {
            lines.push({ t: 'text', v: 'C:\\heel\\merch\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'stickers\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[bumper]', cmd: 'cd bumper' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[bundle]', cmd: 'cd bundle' });
            lines.push({ t: 'dirlink', label: tc(1, true)  + '[<- back]',        cmd: 'cd ..'            });

        } else if (currentDir === 'merch/segmentation') {
            lines.push({ t: 'text', v: 'C:\\heel\\merch\\' });
            lines.push({ t: 'text', v: tc(0, true) + 'segmentation\\' });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[cd]',       cmd: 'cd cd'       });
            lines.push({ t: 'dirlink', label: tc(1, false) + '[cassette]', cmd: 'cd cassette' });
            lines.push({ t: 'dirlink', label: tc(1, true)  + '[<- back]',  cmd: 'cd ..'       });

        } else if (getMerchItem(currentDir)) {
            var mitem = getMerchItem(currentDir);
            lines.push({ t: 'text', v: promptPath() + '\\' });
            lines.push({ t: 'dirlink', label: tc(0, false) + 'photo.jpg', cmd: './photo.jpg' });
            if (mitem.price) {
                lines.push({ t: 'dirlink', label: tc(0, false) + 'price.txt <span style="opacity:0.55">\u2014 ' + mitem.price + '</span>', cmd: 'cat price.txt' });
            }
            if (mitem.href) {
                lines.push({ t: 'dirlink', label: tc(0, false) + 'buy.exe', cmd: 'buy.exe' });
            }
            lines.push({ t: 'dirlink', label: tc(0, true) + '[<- back]', cmd: 'cd ..' });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a file to open, or 'buy.exe' to purchase", dim: true });

        } else if (MEMBERS[currentDir]) {
            /* member directory */
            var mem = MEMBERS[currentDir];
            lines.push({ t: 'text', v: 'C:\\heel\\users\\' + currentDir + '\\' });
            lines.push({ t: 'dirlink', label: tc(0, false) + 'profile.txt',   cmd: 'cat profile.txt'  });
            if (mem.gear)  lines.push({ t: 'dirlink', label: tc(0, false) + 'gear.txt',  cmd: 'cat gear.txt'  });
            if (mem.data) lines.push({ t: 'dirlink', label: tc(0, false) + 'data.txt', cmd: 'cat data.txt' });
            lines.push({ t: 'dirlink', label: tc(0, false) + 'photo.jpg', cmd: './photo.jpg' });
            lines.push({ t: 'dirlink', label: tc(0, true)  + '[<- back]', cmd: 'cd ..'      });
            lines.push({ t: 'blank' });
            lines.push({ t: 'text', v: "click a file, 'cat &lt;file.txt&gt;', or './&lt;file&gt;' to open", dim: true });
        }

        lines.push({ t: 'blank' });
        return lines;
    }

    function memberLines(name) {
        var mem = MEMBERS[name];
        var lines = [
            { t: 'blank' },
            { t: 'text', v: 'C:\\heel\\users\\' + name + '\\' },
            { t: 'dirlink', label: tc(0, false) + 'profile.txt',   cmd: 'cat profile.txt'  },
        ];
        if (mem.gear)  lines.push({ t: 'dirlink', label: tc(0, false) + 'gear.txt',  cmd: 'cat gear.txt'  });
        if (mem.data) lines.push({ t: 'dirlink', label: tc(0, false) + 'data.txt', cmd: 'cat data.txt' });
        lines.push({ t: 'dirlink', label: tc(0, false) + 'photo.jpg', cmd: './photo.jpg' });
        lines.push({ t: 'dirlink', label: tc(0, true)  + '[<- back]', cmd: 'cd ..'      });
        lines.push({ t: 'blank' });
        lines.push({ t: 'text', v: "click a file, 'cat &lt;file.txt&gt;', or './&lt;file&gt;' to open", dim: true });
        lines.push({ t: 'blank' });
        return lines;
    }

    function navigateTo(dir) {
        dir = MERCH_LABEL_MAP[dir] || dir;
        currentDir = dir;
        updatePrompt();
        cdClear();
        if (MEMBERS[dir])      return memberLines(dir);
        if (getMerchItem(dir)) {
            return merchItemLines(dir);
        }
        return dir === 'root' ? [] : dirListing();
    }

    function merchItemLines(id) {
        var mitem = getMerchItem(id);
        var mpar  = DIR_PARENTS[id] || 'merch';
        var mlabel2 = mitem && mitem.label ? mitem.label : id;
        var pathLabel;
        if (mpar === 'merch/segmentation') pathLabel = 'C:\\heel\\merch\\segmentation\\' + mlabel2 + '\\';
        else if (mpar === 'merch/stickers') pathLabel = 'C:\\heel\\merch\\stickers\\' + id + '\\';
        else                                pathLabel = 'C:\\heel\\merch\\' + mlabel2 + '\\';
        var lines = [
            { t: 'blank' },
            { t: 'text', v: pathLabel },
            { t: 'dirlink', label: tc(0, false) + 'photo.jpg', cmd: './photo.jpg' },
        ];
        if (mitem && mitem.samples) {
            mitem.samples.forEach(function (s) {
                var fname = s.split('/').pop();
                lines.push({ t: 'dirlink', label: tc(0, false) + fname, cmd: './' + fname });
            });
        }
        if (mitem && mitem.photo && window.innerWidth <= 900) {
            lines.push({ t: 'blank' });
            lines.push({ t: 'img-reveal', src: mitem.photo, width: '80%' });
        }
        if (mitem && mitem.price) {
            lines.push({ t: 'dirlink', label: tc(0, false) + 'price.txt <span style="opacity:0.55">\u2014 ' + mitem.price + '</span>', cmd: 'cat price.txt' });
        }
        if (mitem && mitem.href) {
            lines.push({ t: 'dirlink', label: tc(0, false) + 'buy.exe', cmd: 'buy.exe' });
        }
        lines.push({ t: 'dirlink', label: tc(0, true) + '[<- back]', cmd: 'cd ..' });
        lines.push({ t: 'blank' });
        if (mitem && mitem.href) {
            lines.push({ t: 'text', v: "click 'buy.exe' or type 'buy' to purchase", dim: true });
        }
        lines.push({ t: 'blank' });
        return lines;
    }

    /* ─── boot sequence ───────────────────────────────────── */

    var BOOT_LINES_PRE = [
        { t: 'text', v: 'WELT BIOS v1.0 &nbsp;&nbsp;&nbsp;(C) HEEL CORPORATION 2023', dim: true },
        { t: 'blank' },
        { t: 'text', v: 'CPU: Intel(R) Pentium(R) II @ 300 MHz' },
        { t: 'text', v: 'MEMORY TEST: 65536K ......... OK' },
        { t: 'blank' },
        { t: 'text', v: 'DETECTING STORAGE:' },
        { t: 'detect', v: '&nbsp;&nbsp;C:\\ BITE.HDD', detectDelay: 1200, maxDots: 7 },
        { t: 'blank' },
        { t: 'text', v: 'LOADING DRIVERS:' },
        { t: 'driver', label: 'DISTORTION.SYS', driverDelay: 700, maxDots: 5 },
        { t: 'driver', label: 'REVERB.DRV',     driverDelay: 550, maxDots: 4 },
        { t: 'driver', label: 'FEEDBACK.VXD',   driverDelay: 600, maxDots: 4 },
        { t: 'blank' },
        { t: 'detect', v: 'VISITOR COUNT', detectDelay: 900, maxDots: function () { return (visitorCount || '---').length + 2; }, result: function () { return '[' + (visitorCount || '---') + ']'; } },
        { t: 'blank' },
        { t: 'text', v: 'AUTOEXEC.BAT: HL-DOS.exe' },
        { t: 'blank' },
        { t: 'progress', blocks: 20, duration: 2000 },
    ];

    var BOOT_LINES_POST = [
        { t: 'blank' },
        { t: 'text', v: 'Solaris OS [Version 1.0.2023]', dim: true },
        { t: 'text', v: '(C) Copyright HEEL Corp 2023. All rights reserved.', dim: true },
        { t: 'blank' },
    ];

    var WELCOME_LINES = [
        { t: 'blank' },
        { t: 'ascii-anim',
          rows: [
              '||     || ||===== ||===== ||     ',
              '||=====|| ||===   ||===   ||     ',
              '||     || ||===== ||===== ||====='
          ],
          charDelay: 30 },
    ];

    /* ─── command definitions ──────────────────────────────── */

    function fetchLyrics(tr) {
        var lyricsFile = 'sounds/music/segmentation/lyrics/' + (tr.lyricsFile || tr.id.replace(/\s+/g, '_') + '.txt');
        printLines([{ t: 'blank' }, { t: 'text', v: 'fetching lyrics...', dim: true }]);
        fetch(lyricsFile)
            .then(function (r) {
                if (!r.ok) throw new Error('not found');
                return r.text();
            })
            .then(function (text) {
                var lyricLines = [];
                text.split('\n').forEach(function (line) {
                    lyricLines.push(line.trim() === '' ? { t: 'blank' } : { t: 'typewriter', v: line, charDelay: 14 });
                });
                lyricLines.push({ t: 'blank' });
                // print header, then each lyric line one at a time so they scroll in sequence
                printLines([{ t: 'blank' }, { t: 'text', v: tr.label.toUpperCase(), spaced: true }], function () {
                    (function printNext(i) {
                        if (i >= lyricLines.length) return;
                        printLines([lyricLines[i]], function () { printNext(i + 1); });
                    }(0));
                });
            })
            .catch(function () {
                printLines([{ t: 'error', v: 'lyrics not found for this track.' }, { t: 'blank' }]);
            });
    }

    var COMMANDS = {

        'help': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'USAGE:&nbsp;&nbsp;&#60;command&#62; [--flag]', dim: true },
                { t: 'blank' },
                { t: 'hrow', cmd: 'ls',                     desc: 'list current directory', exec: 'ls'                     },
                { t: 'hrow', cmd: 'cd &lt;dir&gt;',         desc: 'open a folder',         exec: 'cd'                     },
                { t: 'hrow', cmd: 'play &lt;track&gt;',     desc: '',                      exec: 'cd music'               },
                { t: 'hrow-parent', cmd: 'fetch <span style="opacity:0.45">--&lt;flag&gt;</span>'                        },
                { t: 'hrow-sub',  flag: '--new-releases',   desc: '',                      exec: 'fetch --new-releases',   last: false },
                { t: 'hrow-sub',  flag: '--socials',        desc: '',                      exec: 'fetch --socials',        last: false },
                { t: 'hrow-sub',  flag: '--streaming',      desc: '',                      exec: 'fetch --streaming',      last: false },
                { t: 'hrow-sub',  flag: '--upcoming-shows', desc: '',                      exec: 'fetch --upcoming-shows', last: true  },
                { t: 'hrow', cmd: 'neofetch',               desc: '',                      exec: 'neofetch'               },
                { t: 'hrow', cmd: 'clear',                  desc: '',                      exec: 'clear'                  },
                { t: 'blank' },
                { t: 'text', v: '<span style="opacity:0.6">click or type commands</span>' },
                { t: 'blank' },
            ];
        },

        'fetch --new-releases': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'SEGMENTATION \u2014 OUT NOW', center: true, spaced: true },
                { t: 'img-reveal', src: 'images/album_front_cover.png', width: '120px', pixelated: false, center: true, href: 'https://heelband.bandcamp.com/album/segmentation', caption: '> CLICK HERE TO LISTEN <' },
                { t: 'blank' },
            ];
        },

        'fetch --streaming': function () {
            return [
                { t: 'blank' },
                { t: 'link', label: 'spotify',     href: 'https://open.spotify.com/artist/6663RkcENJxc1KnuKZaRla', value: 'heel' },
                { t: 'link', label: 'apple music', href: 'https://music.apple.com/us/artist/heel/1765219586',       value: 'heel' },
                { t: 'link', label: 'bandcamp',    href: 'https://heelband.bandcamp.com/album/segmentation',        value: 'heel' },
                { t: 'blank' },
            ];
        },
        'stream --heel': function () { return COMMANDS['fetch --streaming'](); },

        'watch --all': function () { return COMMANDS['cd video'](); },

        'fetch --socials': function () {
            return [
                { t: 'blank' },
                { t: 'link', label: 'instagram', href: 'https://www.instagram.com/heel.mp3/',    value: '@heel.mp3'            },
                { t: 'link', label: 'booking',   href: 'mailto:heelbooking@gmail.com',           value: 'heelbooking@gmail.com' },
                { t: 'blank' },
            ];
        },

        'fetch --upcoming-shows': function () {
            var lines = [{ t: 'blank' }];
            if (SHOWS.length === 0) {
                lines.push({ t: 'text', v: 'no upcoming shows.', dim: true });
            } else {
                SHOWS.forEach(function (s) {
                    var value = s.city + (s.venue ? ' \u2014 ' + s.venue : '');
                    lines.push(s.href
                        ? { t: 'link',   label: s.date.toLowerCase(), value: value, href: s.href }
                        : { t: 'nolink', label: s.date.toLowerCase(), value: value }
                    );
                });
            }
            lines.push({ t: 'blank' });
            return lines;
        },

        'ls': function () { return dirListing(); },
        'dir': function () { return dirListing(); },

        'cd': function () { return dirListing(); },

        'cd ..': function () {
            if (currentDir === 'root') {
                return [{ t: 'blank' }, { t: 'error', v: 'already at root.' }, { t: 'blank' }];
            }
            var parent = DIR_PARENTS[currentDir] || 'root';
            currentDir = parent;
            updatePrompt();
            cdClear();
            return dirListing();
        },
        'cd ../':  function () { return COMMANDS['cd ..'](); },
        'cd back': function () { return COMMANDS['cd ..'](); },
        'back':    function () { return COMMANDS['cd ..'](); },

        'cd /':  function () { currentDir = 'root'; updatePrompt(); cdClear(); return []; },
        'cd \\': function () { currentDir = 'root'; updatePrompt(); cdClear(); return []; },

        'cd users': function () {
            currentDir = 'users';
            updatePrompt();
            cdClear();
            return dirListing();
        },

        'cd adharsh': function () { currentDir = 'adharsh'; updatePrompt(); cdClear(); return memberLines('adharsh'); },
        'cd tayla':   function () { currentDir = 'tayla';   updatePrompt(); cdClear(); return memberLines('tayla');   },
        'cd nick':    function () { currentDir = 'nick';    updatePrompt(); cdClear(); return memberLines('nick');    },
        'cd andres':  function () { currentDir = 'andres';  updatePrompt(); cdClear(); return memberLines('andres'); },

        'cd video':              function () { return navigateTo('video');               },
        'cd photo':              function () { return navigateTo('photo');               },
        'cd wallpapers':         function () { return navigateTo('wallpapers');          },
        'cd merch':               function () { return navigateTo('merch');                },
        'cd obey_tshirt':           function () { return navigateTo('obey_tshirt');         },
        'cd segmentation_cd':       function () { return navigateTo('segmentation_cd');     },
        'cd segmentation_cassette': function () { return navigateTo('segmentation_cassette'); },
        'cd bundle':                function () { return navigateTo('bundle');              },
        /* short-name aliases */
        'cd cd':       function () { return navigateTo('cd');       },
        'cd cassette': function () { return navigateTo('cassette'); },
        'cd bumper':         function () { return navigateTo('bumper');         },
        'cd stickers':       function () { return navigateTo('merch/stickers'); },
        'cd zine':           function () { return navigateTo('zine');           },

        'buy.exe': function () {
            var mitem = getMerchItem(currentDir);
            if (!mitem || !mitem.href) return [{ t: 'blank' }, { t: 'error', v: 'no such executable.' }, { t: 'blank' }];
            window.open(mitem.href, '_blank');
            return [{ t: 'blank' }, { t: 'text', v: 'launching checkout...', dim: true }, { t: 'blank' }];
        },

        'price.txt': function () {
            var mitem = getMerchItem(currentDir);
            if (!mitem || !mitem.price) return [{ t: 'blank' }, { t: 'error', v: 'no such file.' }, { t: 'blank' }];
            return [{ t: 'blank' }, { t: 'typewriter', v: mitem.price }, { t: 'blank' }];
        },
        'cat price.txt': function () { return COMMANDS['price.txt'](); },
        'cat price':     function () { return COMMANDS['price.txt'](); },
        'price':         function () { return COMMANDS['price.txt'](); },

        'cd music': function () {
            currentDir = 'music'; updatePrompt();
            cdClear();
            return dirListing();
        },
        'cd segmentation': function () {
            if (currentDir === 'merch') return navigateTo('merch/segmentation');
            return navigateTo('music/segmentation');
        },
        'cd unreleased': function () {
            currentDir = 'music/unreleased'; updatePrompt();
            cdClear();
            return dirListing();
        },
        'cd sgmt_demos':   function () { return navigateTo('sgmt_demos');   },
        'cd heel2_demos':  function () { return navigateTo('heel2_demos');  },

        'cat about.txt': function () {
            return [{ t: 'blank' }, { t: 'typewriter', v: 'heel is a four-piece from college station, texas.' }, { t: 'blank' }];
        },
        'cat about': function () { return COMMANDS['cat about.txt'](); },
        'about.txt': function () { return COMMANDS['cat about.txt'](); },
        'about':     function () { return COMMANDS['cat about.txt'](); },

        'neofetch': function () {
            var art = [
                '||     || ||===== ||===== ||     ',
                '||=====|| ||===   ||===   ||     ',
                '||     || ||===== ||===== ||====='
            ].join('\n');

            var g = '#33ff33';
            var dim = 'opacity:0.55';

            function row(key, val) {
                return '<span style="color:' + g + ';font-weight:bold">' + key + '</span>'
                     + '<span style="' + dim + '">:</span> ' + val;
            }

            var sep = '<span style="' + dim + '">──────────────────────</span>';

            var colors = ['#111','#1a1a1a','#003300','#005500','#008800','#00bb00','#33ff33','#99ff99'];
            var palette = colors.map(function (c) {
                return '<span style="color:' + c + '">███</span>';
            }).join('');

            var info = [
                '<span style="color:' + g + ';font-weight:bold">heel</span><span style="' + dim + '">@</span><span style="color:' + g + ';font-weight:bold">hl-dos</span>',
                sep,
                row('OS     ', 'HL-DOS v1.0.2023'),
                row('Host   ', 'Welt BIOS v1.0'),
                row('Kernel ', 'Segmentation 1.0.2023'),
                row('Shell  ', 'PS C:\\heel&gt;'),
                row('Uptime ', 'est. 2023'),
                row('Members', 'adharsh · tayla · nick · andres'),
                row('Genre  ', 'rock'),
                row('Label  ', 'independent'),
                row('Albums ', 'Segmentation (2023)'),
                row('Booking', 'heelbooking@gmail.com'),
                '',
                palette,
            ].join('<br>');

            return [
                { t: 'blank' },
                { t: 'text', v:
                    '<div style="display:flex;gap:2em;align-items:flex-start">'
                  + '<pre style="color:' + g + ';margin:0;line-height:1.6;flex-shrink:0;font-family:inherit">' + art + '</pre>'
                  + '<div style="line-height:1.6">' + info + '</div>'
                  + '</div>'
                },
                { t: 'blank' },
            ];
        },

        'cat profile.txt': function () {
            var member = MEMBERS[currentDir];
            if (!member) return [{ t: 'blank' }, { t: 'error', v: 'no such file.' }, { t: 'blank' }];
            var lines = [ { t: 'blank' } ];
            if (member.profile) {
                lines.push({ t: 'typewriter', v: member.profile });
            } else {
                lines.push({ t: 'nolink', label: 'instrument', value: member.instrument });
            }
            lines.push({ t: 'blank' });
            return lines;
        },
        'cat profile':  function () { return COMMANDS['cat profile.txt'](); },
        'profile.txt':  function () { return COMMANDS['cat profile.txt'](); },
        'profile':      function () { return COMMANDS['cat profile.txt'](); },

        'cat gear.txt': function () {
            var member = MEMBERS[currentDir];
            if (!member || !member.gear) return [{ t: 'blank' }, { t: 'error', v: 'no such file.' }, { t: 'blank' }];
            return [{ t: 'blank' }, { t: 'typewriter', v: member.gear }, { t: 'blank' }];
        },
        'cat gear':  function () { return COMMANDS['cat gear.txt'](); },
        'gear.txt':  function () { return COMMANDS['cat gear.txt'](); },
        'gear':      function () { return COMMANDS['cat gear.txt'](); },

        'cat data.txt': function () {
            var member = MEMBERS[currentDir];
            if (!member || !member.data) return [{ t: 'blank' }, { t: 'error', v: 'no such file.' }, { t: 'blank' }];
            return [{ t: 'blank' }, { t: 'typewriter', v: member.data }, { t: 'blank' }];
        },
        'cat data':  function () { return COMMANDS['cat data.txt'](); },
        'data.txt':  function () { return COMMANDS['cat data.txt'](); },
        'data':      function () { return COMMANDS['cat data.txt'](); },

        'cat readme.txt': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'MUSIC PLAYER', spaced: true },
                { t: 'blank' },
                { t: 'hrow', cmd: 'play &lt;track&gt;', desc: 'play a track by name' },
                { t: 'hrow', cmd: 'pause',             desc: 'pause playback'       },
                { t: 'hrow', cmd: 'resume',            desc: 'resume playback'      },
                { t: 'hrow', cmd: 'stop',              desc: 'stop playback'        },
                { t: 'hrow', cmd: 'lyrics',            desc: 'show lyrics for current track' },
                { t: 'blank' },
                { t: 'text', v: "navigate to a directory and click a track,", dim: true },
                { t: 'text', v: "or type 'play &lt;track name&gt;'", dim: true },
                { t: 'blank' },
            ];
        },
        'cat readme': function () { return COMMANDS['cat readme.txt'](); },
        'readme':     function () { return COMMANDS['cat readme.txt'](); },

        'sudo rm -rf':         function () { triggerJumpscare(); return []; },
        'sudo rm -rf /':       function () { triggerJumpscare(); return []; },
        'delete system32':     function () { triggerJumpscare(); return []; },
        'format c:':           function () { triggerJumpscare(); return []; },
        'format c:/':          function () { triggerJumpscare(); return []; },
        'shutdown /s':         function () { triggerJumpscare(); return []; },
        'shutdown /s /t 0':    function () { triggerJumpscare(); return []; },
        'rd /s /q c:':         function () { triggerJumpscare(); return []; },
        ':(){:|:&};:':         function () { triggerJumpscare(); return []; },

        'cat cat': function () {
            var cats = ['(=^･ω･^=)', '(=^･^=)', '/ᐠ｡ꞈ｡ᐟ\\', '(=ΦωΦ=)', '=^_^=', '(^･o･^)', ':3'];
            var pick = cats[Math.floor(Math.random() * cats.length)];
            return [{ t: 'blank' }, { t: 'text', v: pick }, { t: 'blank' }];
        },

        'pause': function () {
            if (!currentAudio || audioPaused) {
                return [{ t: 'blank' }, { t: 'error', v: 'nothing is playing.' }, { t: 'blank' }];
            }
            currentAudio.pause();
            audioPaused = true;
            return [{ t: 'blank' }, { t: 'text', v: 'paused.', dim: true }, { t: 'blank' }];
        },
        'resume': function () {
            if (!currentAudio || !audioPaused) {
                return [{ t: 'blank' }, { t: 'error', v: 'nothing is paused.' }, { t: 'blank' }];
            }
            currentAudio.play().catch(function () {});
            audioPaused = false;
            return [{ t: 'blank' }, { t: 'text', v: 'resuming.', dim: true }, { t: 'blank' }];
        },
        'stop': function () {
            if (!currentAudio) {
                return [{ t: 'blank' }, { t: 'error', v: 'nothing is playing.' }, { t: 'blank' }];
            }
            currentAudio.pause();
            currentAudio = null;
            audioPaused = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
            return [{ t: 'blank' }, { t: 'text', v: 'stopped.', dim: true }, { t: 'blank' }];
        },

        'lyrics': function () {
            if (!currentAudio) {
                return [{ t: 'blank' }, { t: 'error', v: 'nothing is playing.' }, { t: 'blank' }];
            }
            // try weltamp track first, then fall back to terminal-played track by label
            var tr = (playerTrackList && playerTrackList[playerTrackIndex]) || null;
            if (!tr && currentTrackLabel) {
                var lbl = currentTrackLabel.toLowerCase();
                tr = TRACKS.segmentation.find(function (t) { return t.label.toLowerCase() === lbl; }) || null;
            }
            if (!tr || !tr.lyricsFile) {
                return [{ t: 'blank' }, { t: 'error', v: 'lyrics not available for this track.' }, { t: 'blank' }];
            }
            fetchLyrics(tr);
            return [];
        },

        /* ── command aliases ── */
        'stream heel':            function () { return COMMANDS['fetch --streaming'](); },
        'stream -heel':           function () { return COMMANDS['fetch --streaming'](); },
        'fetch stream':           function () { return COMMANDS['fetch --streaming'](); },
        'fetch -stream':          function () { return COMMANDS['fetch --streaming'](); },
        'fetch streaming':        function () { return COMMANDS['fetch --streaming'](); },
        'fetch -streaming':       function () { return COMMANDS['fetch --streaming'](); },
        'stream':                 function () { return COMMANDS['fetch --streaming'](); },
        'watch all':              function () { return COMMANDS['watch --all'](); },
        'watch -all':             function () { return COMMANDS['watch --all'](); },
        'fetch social':           function () { return COMMANDS['fetch --socials'](); },
        'fetch -social':          function () { return COMMANDS['fetch --socials'](); },
        'fetch socials':          function () { return COMMANDS['fetch --socials'](); },
        'fetch -socials':         function () { return COMMANDS['fetch --socials'](); },
        'fetch new releases':     function () { return COMMANDS['fetch --new-releases'](); },
        'fetch new-releases':     function () { return COMMANDS['fetch --new-releases'](); },
        'fetch -new-releases':    function () { return COMMANDS['fetch --new-releases'](); },
        'fetch upcoming shows':   function () { return COMMANDS['fetch --upcoming-shows'](); },
        'fetch upcoming-shows':   function () { return COMMANDS['fetch --upcoming-shows'](); },
        'fetch -upcoming-shows':  function () { return COMMANDS['fetch --upcoming-shows'](); },

        'clear': function () {
            output.innerHTML = '';
            return [];
        },

        'breakout':     function () { openBreakout();     return []; },
        'minesweeper':  function () { openMinesweeper(); return []; },

        'segmentation tracklist': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: '1. Segmentation (Intro)' },
                { t: 'text', v: '2. Stare' },
                { t: 'text', v: '3. August' },
                { t: 'text', v: '4. Through Me' },
                { t: 'text', v: '5. Daisy Chain' },
                { t: 'text', v: '6. Some Other Memory' },
                { t: 'text', v: '7. Waste' },
                { t: 'text', v: '8. You\'re So Far Away' },
                { t: 'text', v: '9. In My Way' },
                { t: 'text', v: '10. Honeycomb' },
                { t: 'blank' },
            ];
        },

        'segmentation band': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'Adharsh Rajavel' },
                { t: 'text', v: 'Nicholas Dienstbier' },
                { t: 'text', v: 'Andres Gonzalez' },
                { t: 'text', v: 'Tayla Diza' },
                { t: 'blank' },
            ];
        },

        'segmentation produced_mixed_by': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'Adharsh Rajavel' },
                { t: 'text', v: 'Toby Pipes' },
                { t: 'blank' },
            ];
        },

        'segmentation engineered_by': function () {
            return [{ t: 'blank' }, { t: 'text', v: 'Toby Pipes' }, { t: 'blank' }];
        },

        'segmentation mastered_by': function () {
            return [{ t: 'blank' }, { t: 'text', v: 'Todd Pipes' }, { t: 'blank' }];
        },

        'segmentation cover_by': function () {
            return [{ t: 'blank' }, { t: 'text', v: 'Adharsh Rajavel' }, { t: 'blank' }];
        },

        'segmentation thank_you': function () {
            return [
                { t: 'blank' },
                { t: 'text', v: 'Toby Pipes' },
                { t: 'text', v: 'Frankie Polonsky' },
                { t: 'text', v: 'Bryan/College Station' },
                { t: 'text', v: 'KANM' },
                { t: 'text', v: 'Andie and Willow' },
                { t: 'blank' },
            ];
        },
    };

    /* ─── render a line descriptor into a DOM element ─────── */

    function render(line) {
        var el;
        switch (line.t) {

            case 'blank':
                el = document.createElement('div');
                el.style.height = '0.5em';
                return el;

            case 'text':
                el = document.createElement('div');
                el.className = 'out-text' + (line.dim ? ' dim' : '');
                if (line.center) el.style.textAlign  = 'center';
                if (line.spaced) el.style.letterSpacing = '2px';
                el.innerHTML = line.v;
                return el;

            case 'hrow':
                el = document.createElement('div');
                el.className = 'help-row' + (line.exec ? ' clickable' : '');
                if (line.sub) el.style.paddingLeft = '2ch';
                el.innerHTML = '<span class="help-cmd">' + line.cmd  + '</span>'
                             + '<span class="help-desc">' + line.desc + '</span>';
                if (line.exec) el.addEventListener('click', (function (cmd) {
                    return function () { typeAndExecute(cmd, true); };
                }(line.exec)));
                return el;

            case 'hrow-parent':
                el = document.createElement('div');
                el.className = 'help-row help-parent';
                el.innerHTML = '<span class="help-cmd">' + line.cmd + '</span>';
                return el;

            case 'hrow-sub':
                el = document.createElement('div');
                el.className = 'help-row' + (line.exec ? ' clickable' : '');
                el.innerHTML = '<span class="help-cmd">'
                             + '<span class="tree-char">' + (line.last ? '└── ' : '├── ') + '</span>'
                             + line.flag
                             + '</span>'
                             + '<span class="help-desc">' + line.desc + '</span>';
                if (line.exec) el.addEventListener('click', (function (cmd) {
                    return function () { typeAndExecute(cmd, true); };
                }(line.exec)));
                return el;

            case 'prompt':
                el = document.createElement('div');
                el.className = 'out-prompt';
                el.innerHTML = '<span class="prompt-prefix">' + promptHTML() + '</span> ' + esc(line.v);
                return el;

            case 'error':
                el = document.createElement('div');
                el.className = 'out-error';
                el.innerHTML = line.v;
                return el;

            case 'link':
                el = document.createElement('a');
                el.className = 'social-line';
                el.href      = line.href;
                el.target    = '_blank';
                el.rel       = 'noopener';
                el.innerHTML = '<span class="social-platform">' + line.label + '</span>'
                             + (line.value ? '<span class="social-dots"></span><span class="social-handle">' + line.value + '</span>' : '');
                if (line.vlcId) {
                    (function (id, title) {
                        el.addEventListener('click', function (e) {
                            if (window.innerWidth <= 900) return;
                            e.preventDefault();
                            openVlc(id, title);
                        });
                    }(line.vlcId, line.vlcTitle));
                }
                return el;

            case 'nolink':
                el = document.createElement('div');
                el.className = 'term-row';
                el.innerHTML = '<span class="social-platform">' + line.label + '</span>'
                             + '<span class="social-dots"></span>'
                             + '<span class="social-handle">'   + line.value + '</span>';
                return el;

            case 'album':
                el = document.createElement('div');
                el.innerHTML =
                    '<a href="https://heelband.bandcamp.com/album/segmentation"'
                    + ' class="album-cover-link" target="_blank" rel="noopener">'
                    + '<img src="images/album_front_cover.png" alt="Heel \u2014 Segmentation">'
                    + '<span class="click-to-listen">&gt; CLICK HERE TO LISTEN &lt;</span>'
                    + '</a>';
                return el;

            case 'ascii':
                el = document.createElement('div');
                el.className = 'out-text';
                el.style.textAlign  = 'center';
                el.style.whiteSpace = 'pre';
                el.textContent = line.v;
                return el;

            case 'ascii-anim':
                el = document.createElement('div');
                for (var ri = 0; ri < line.rows.length; ri++) {
                    var rowEl = document.createElement('div');
                    rowEl.className = 'out-text';
                    rowEl.style.textAlign  = 'center';
                    rowEl.style.whiteSpace = 'pre';
                    rowEl.textContent = '';
                    el.appendChild(rowEl);
                }
                return el;

            case 'typewriter':
                el = document.createElement('div');
                el.className = 'out-text';
                el.style.paddingLeft  = '2px';
                el.style.whiteSpace   = 'pre-wrap';
                return el;

            case 'img-reveal':
                el = document.createElement('div');
                el.style.marginTop = '8px';
                el.style.overflow  = 'hidden';
                el.style.maxWidth  = '100%';
                if (line.center) { el.style.textAlign = 'center'; }
                var imgEl = document.createElement('img');
                imgEl.src   = line.src;
                imgEl.alt   = '';
                imgEl.style.display             = line.center ? 'inline-block' : 'block';
                imgEl.style.width               = line.width || '150px';
                if (line.pixelated !== false) imgEl.style.imageRendering = 'pixelated';
                imgEl.style.border              = '1px solid #33ff33';
                imgEl.style.clipPath    = 'inset(0 0 100% 0)';
                if (line.href) {
                    var imgWrap = document.createElement('a');
                    imgWrap.href   = line.href;
                    imgWrap.target = '_blank';
                    imgWrap.rel    = 'noopener';
                    imgWrap.style.display     = 'block';
                    imgWrap.style.width       = 'fit-content';
                    if (line.center) { imgWrap.style.margin = '0 auto'; }
                    imgWrap.style.textDecoration = 'none';
                    imgWrap.appendChild(imgEl);
                    if (line.caption) {
                        var capEl = document.createElement('span');
                        capEl.className   = 'click-to-listen';
                        capEl.textContent = line.caption;
                        imgWrap.appendChild(capEl);
                    }
                    el.appendChild(imgWrap);
                } else {
                    el.appendChild(imgEl);
                }
                el._imgEl = imgEl;
                return el;

            case 'dirlink':
                el = document.createElement('div');
                el.className = 'dir-line';
                el.innerHTML = line.label;
                el.addEventListener('click', (function (cmd) {
                    return function () { typeAndExecute(cmd, true); };
                }(line.cmd)));
                return el;

            case 'dirrow':
                el = document.createElement('div');
                el.className = 'social-line';
                el.style.cursor = 'pointer';
                el.innerHTML = '<span class="social-platform">' + line.label + '</span>'
                             + '<span class="social-dots"></span>'
                             + '<span class="social-handle">'   + line.value + '</span>';
                el.addEventListener('click', (function (cmd) {
                    return function () { typeAndExecute(cmd, true); };
                }(line.cmd)));
                return el;

            case 'detect':
                el = document.createElement('div');
                el.className = 'out-text';
                el.innerHTML = line.v;
                return el;

            case 'driver':
                el = document.createElement('div');
                el.className = 'out-text';
                el.innerHTML = '&nbsp;&nbsp;' + line.label;
                return el;

            case 'progress':
                el = document.createElement('div');
                el.className = 'out-text';
                var emptyBar = '';
                for (var i = 0; i < (line.blocks || 20); i++) emptyBar += '\u2591';
                el.innerHTML = emptyBar + '  0%';
                return el;
        }
        return null;
    }

    /* ─── animate lines into #output ──────────────────────── */

    function printLines(lines, done, lineDelay, blankDelay) {
        lineDelay  = lineDelay  || 65;
        blankDelay = blankDelay || 25;
        animating  = true;
        inputRow.style.visibility = 'hidden';

        /* progress, ascii-anim, img-reveal, and typewriter fire done themselves */
        var selfManagesDone = lines.some(function (l) {
            return l.t === 'progress' || l.t === 'ascii-anim' || l.t === 'img-reveal' || l.t === 'typewriter';
        });

        var gen = printGeneration;
        var delay = 0;
        lines.forEach(function (line) {

            if (line.t === 'detect') {
                setTimeout(function () {
                    if (printGeneration !== gen) return;
                    var el = render(line);
                    if (!el) return;
                    output.appendChild(el);
                    scrollBottom();
                    var dots = 0;
                    var maxDots    = typeof line.maxDots === 'function' ? line.maxDots() : (line.maxDots || 6);
                    var dotInterval = (line.detectDelay || 1200) / (maxDots + 1);
                    var iv = setInterval(function () {
                        dots++;
                        if (dots < maxDots) {
                            var s = '';
                            for (var d = 0; d < dots; d++) s += '.';
                            el.innerHTML = line.v + ' ' + s;
                            scrollBottom();
                        } else {
                            var fs = '';
                            for (var fd = 0; fd < maxDots; fd++) fs += '.';
                            clearInterval(iv);
                            var resultText = typeof line.result === 'function' ? line.result() : (line.result || '[FOUND]');
                            flashResolve(el,
                                line.v + ' ' + fs,
                                line.v + ' ' + fs + ' ' + resultText,
                                scrollBottom
                            );
                        }
                    }, dotInterval);
                }, delay);
                delay += (line.detectDelay || 1200) + lineDelay;

            } else if (line.t === 'driver') {
                setTimeout(function () {
                    if (printGeneration !== gen) return;
                    var el = render(line);
                    if (!el) return;
                    output.appendChild(el);
                    scrollBottom();
                    var dots = 0;
                    var maxDots     = line.maxDots     || 4;
                    var dotInterval = (line.driverDelay || 700) / (maxDots + 1);
                    var iv = setInterval(function () {
                        dots++;
                        if (dots < maxDots) {
                            var s = '';
                            for (var d = 0; d < dots; d++) s += '.';
                            el.innerHTML = '&nbsp;&nbsp;' + line.label + ' ' + s;
                            scrollBottom();
                        } else {
                            var fs = '';
                            for (var fd = 0; fd < maxDots; fd++) fs += '.';
                            clearInterval(iv);
                            flashResolve(el,
                                '&nbsp;&nbsp;' + line.label + ' ' + fs,
                                '&nbsp;&nbsp;' + line.label + ' ' + fs + ' [ OK ]',
                                scrollBottom
                            );
                        }
                    }, dotInterval);
                }, delay);
                delay += (line.driverDelay || 700) + lineDelay;

            } else if (line.t === 'ascii-anim') {
                setTimeout(function () {
                    if (printGeneration !== gen) return;
                    var el = render(line);
                    if (!el) return;
                    output.appendChild(el);
                    scrollBottom();
                    var rows     = line.rows;
                    var maxChars = rows[0].length;
                    var rowEls   = [];
                    for (var ri = 0; ri < el.children.length; ri++) rowEls.push(el.children[ri]);
                    var revealed = 0;
                    var iv = setInterval(function () {
                        if (printGeneration !== gen) { clearInterval(iv); return; }
                        revealed++;
                        for (var ri = 0; ri < rowEls.length; ri++) {
                            rowEls[ri].textContent = rows[ri].slice(0, revealed);
                        }
                        scrollBottom();
                        if (revealed >= maxChars) {
                            clearInterval(iv);
                            animating = false;
                            inputRow.style.visibility = 'visible';
                            focusInput();
                            scrollBottom();
                            if (done) done();
                        }
                    }, line.charDelay || 45);
                }, delay);
                /* ascii-anim calls done itself — don't add to delay */

            } else if (line.t === 'typewriter') {
                (function (line, delay) {
                    setTimeout(function () {
                        if (printGeneration !== gen) return;
                        var el = render(line);
                        if (!el) return;
                        output.appendChild(el);
                        scrollBottom();
                        var text = line.v;
                        var i = 0;
                        var iv = setInterval(function () {
                            if (printGeneration !== gen) { clearInterval(iv); return; }
                            el.textContent += text[i];
                            i++;
                            scrollBottom();
                            if (i >= text.length) {
                                clearInterval(iv);
                                animating = false;
                                inputRow.style.visibility = 'visible';
                                focusInput();
                                scrollBottom();
                                if (done) done();
                            }
                        }, line.charDelay || 14);
                    }, delay);
                }(line, delay));

            } else if (line.t === 'img-reveal') {
                (function (line, delay) {
                    setTimeout(function () {
                        if (printGeneration !== gen) return;
                        var el = render(line);
                        if (!el) return;
                        output.appendChild(el);
                        scrollBottom();

                        var imgEl = el._imgEl;

                        function startReveal() {
                            var pct = 100;
                            var iv = setInterval(function () {
                                if (printGeneration !== gen) { clearInterval(iv); return; }
                                pct -= 2;
                                if (pct <= 0) {
                                    pct = 0;
                                    clearInterval(iv);
                                    imgEl.style.clipPath = '';
                                    animating = false;
                                    inputRow.style.visibility = 'visible';
                                    focusInput();
                                    scrollBottom();
                                    if (done) done();
                                } else {
                                    imgEl.style.clipPath = 'inset(0 0 ' + pct + '% 0)';
                                }
                                scrollBottom();
                            }, 30);
                        }

                        if (imgEl.complete && imgEl.naturalWidth) {
                            startReveal();
                        } else {
                            imgEl.onload  = startReveal;
                            imgEl.onerror = function () {
                                el.textContent = '[image load error]';
                                animating = false;
                                inputRow.style.visibility = 'visible';
                                focusInput();
                                if (done) done();
                            };
                        }
                    }, delay);
                }(line, delay));
                /* img-reveal calls done itself — don't add to delay */

            } else if (line.t === 'progress') {
                var totalBlocks = line.blocks   || 20;
                var msPerBlock  = (line.duration || 3000) / totalBlocks;
                setTimeout(function () {
                    if (printGeneration !== gen) return;
                    var el = render(line);
                    if (!el) return;
                    output.appendChild(el);
                    scrollBottom();
                    var filled = 0;
                    function fillNext() {
                        if (printGeneration !== gen) return;
                        if (filled >= totalBlocks) {
                            animating = false;
                            inputRow.style.visibility = 'visible';
                            focusInput();
                            scrollBottom();
                            if (done) done();
                            return;
                        }
                        filled++;
                        var bar = '';
                        for (var j = 0; j < totalBlocks; j++) bar += j < filled ? '\u2588' : '\u2591';
                        el.innerHTML = bar + '  ' + Math.round(filled / totalBlocks * 100) + '%';
                        scrollBottom();
                        var stall = Math.random() < 0.2;
                        var next  = stall
                            ? msPerBlock * (3 + Math.random() * 4)
                            : msPerBlock * (0.5 + Math.random() * 1.0);
                        setTimeout(fillNext, next);
                    }
                    fillNext();
                }, delay);
                /* progress calls done itself — don't add to delay */

            } else {
                setTimeout(function () {
                    if (printGeneration !== gen) return;
                    var el = render(line);
                    if (el) { output.appendChild(el); scrollBottom(); }
                }, delay);
                delay += line.t === 'blank' ? blankDelay : lineDelay;
            }
        });

        if (!selfManagesDone) {
            setTimeout(function () {
                if (printGeneration !== gen) return;
                animating = false;
                inputRow.style.visibility = 'visible';
                focusInput();
                scrollBottom();
                if (done) done();
            }, delay + 30);
        }
    }

    /* ─── execute a command string ─────────────────────────── */

    function execute(raw, silent, absolute) {
        var trimmed = raw.trim();
        var lower   = trimmed.toLowerCase();

        if (!silent) {
            output.appendChild(render({ t: 'prompt', v: trimmed }));
            scrollBottom();
        }

        if (!trimmed) return;

        /* context-aware cd: validate and handle single- and multi-segment paths */
        if (lower.indexOf('cd ') === 0) {
            var arg = lower.slice(3).trim();
            if (arg !== '..' && arg !== '../' && arg !== '/' && arg !== '\\' && arg !== 'back') {
                if (arg.indexOf('/') !== -1) {
                    /* multi-segment path: cd users/adharsh, cd music/segmentation, etc. */
                    var segs = arg.split('/').filter(function (s) { return s !== ''; });
                    var walkDir = currentDir;
                    var valid = true;
                    for (var si = 0; si < segs.length; si++) {
                        var seg = segs[si];
                        if (seg === '..') {
                            var parent = DIR_PARENTS[walkDir];
                            if (!parent) { valid = false; break; }
                            walkDir = parent;
                            continue;
                        }
                        var ch = DIR_CHILDREN[walkDir] || [];
                        if (ch.indexOf(seg) === -1) { valid = false; break; }
                        /* resolve child dir key: composite (e.g. music/segmentation) or simple */
                        var composite = (walkDir === 'root' ? '' : walkDir + '/') + seg;
                        walkDir = (DIR_CHILDREN[composite] !== undefined) ? composite : seg;
                    }
                    if (!valid) {
                        output.appendChild(render({ t: 'error', v: '\'' + esc(arg) + '\': no such path.' }));
                        output.appendChild(render({ t: 'blank' }));
                        scrollBottom();
                        return;
                    }
                    printLines(navigateTo(walkDir));
                    return;
                }
                /* single segment — skip hierarchy check for click-based navigation */
                if (!absolute) {
                    var children = DIR_CHILDREN[currentDir] || [];
                    if (children.indexOf(arg) === -1) {
                        output.appendChild(render({ t: 'error', v: '\'' + esc(arg) + '\': no such directory.' }));
                        output.appendChild(render({ t: 'blank' }));
                        scrollBottom();
                        return;
                    }
                }
            }
        }

        /* photo commands: photo / photo.jpg / cat photo.jpg / open photo.jpg etc. */
        var PHOTO_CMDS = ['photo', 'photo.jpg', './photo', './photo.jpg', './ photo.jpg', 'cat photo.jpg', 'cat photo', 'open photo.jpg', 'open photo'];
        if (PHOTO_CMDS.indexOf(lower) !== -1) {
            var photoSrc = null;
            if (MEMBERS[currentDir])        photoSrc = MEMBERS[currentDir].photo;
            else if (getMerchItem(currentDir)) photoSrc = getMerchItem(currentDir).photo;
            if (photoSrc) {
                var isMerch = !!getMerchItem(currentDir);
                if (isMerch && window.innerWidth > 900) {
                    var mitemSet = getMerchItem(currentDir);
                    var pSet = [{ src: mitemSet.photo, file: 'photo.jpg' }];
                    if (mitemSet.samples) mitemSet.samples.forEach(function (s) { pSet.push({ src: s, file: s.split('/').pop() }); });
                    openPhotoViewerWithSet(pSet, 0);
                    printLines([{ t: 'blank' }, { t: 'text', v: 'opening photo.jpg...', dim: true }, { t: 'blank' }]);
                } else {
                    printLines([{ t: 'blank' }, { t: 'img-reveal', src: photoSrc, width: isMerch ? '80%' : '170px', pixelated: !isMerch }, { t: 'blank' }]);
                }
                return;
            }
        }

        /* merch sample file commands: ./sample1.png etc. */
        var curMerchItem = getMerchItem(currentDir);
        if (curMerchItem && curMerchItem.samples) {
            var scmd = lower.indexOf('./') === 0 ? lower.slice(2).trim() : lower;
            for (var sci = 0; sci < curMerchItem.samples.length; sci++) {
                var sfname = curMerchItem.samples[sci].split('/').pop();
                if (scmd === sfname || scmd === sfname.replace(/\.[^.]+$/, '')) {
                    if (window.innerWidth > 900) {
                        var sSet = [{ src: curMerchItem.photo, file: 'photo.jpg' }];
                        curMerchItem.samples.forEach(function (s) { sSet.push({ src: s, file: s.split('/').pop() }); });
                        openPhotoViewerWithSet(sSet, sci + 1);
                        printLines([{ t: 'blank' }, { t: 'text', v: 'opening ' + sfname + '...', dim: true }, { t: 'blank' }]);
                    } else {
                        printLines([{ t: 'blank' }, { t: 'img-reveal', src: curMerchItem.samples[sci], width: '80%' }, { t: 'blank' }]);
                    }
                    return;
                }
            }
        }

        /* video file commands: filename.avi or cat filename.avi */
        if (currentDir === 'video') {
            var vcmd = lower.indexOf('cat ') === 0 ? lower.slice(4).trim() : lower.indexOf('./') === 0 ? lower.slice(2).trim() : lower;
            for (var vci = 0; vci < VIDEOS.length; vci++) {
                if (VIDEOS[vci].file === vcmd || VIDEOS[vci].id === vcmd) {
                    if (window.innerWidth > 900) {
                        openVlc(extractYouTubeId(VIDEOS[vci].href), VIDEOS[vci].id);
                        printLines([{ t: 'blank' }, { t: 'text', v: 'opening ' + VIDEOS[vci].file + '...', dim: true }, { t: 'blank' }]);
                    } else {
                        window.open(VIDEOS[vci].href, '_blank');
                        printLines([{ t: 'blank' }, { t: 'text', v: 'opening ' + VIDEOS[vci].file + '...', dim: true }, { t: 'blank' }]);
                    }
                    return;
                }
            }
        }

        /* photo file commands: filename.jpg or ./filename.jpg */
        if (currentDir === 'photo' || currentDir === 'wallpapers') {
            var pcmd = lower.indexOf('cat ') === 0 ? lower.slice(4).trim() : lower.indexOf('./') === 0 ? lower.slice(2).trim() : lower;
            for (var pci = 0; pci < PHOTOS.length; pci++) {
                if (PHOTOS[pci].file === pcmd || PHOTOS[pci].id === pcmd) {
                    if (currentDir === 'wallpapers' && window.innerWidth > 900) {
                        setWallpaper(PHOTOS[pci].src);
                        printLines([{ t: 'blank' }, { t: 'text', v: 'wallpaper updated.', dim: true }, { t: 'blank' }]);
                    } else if (currentDir === 'wallpapers') {
                        printLines([{ t: 'blank' }, { t: 'error', v: 'wallpaper not supported on mobile.' }, { t: 'blank' }]);
                    } else if (window.innerWidth > 900) {
                        openPhotoViewer(pci);
                        printLines([{ t: 'blank' }, { t: 'text', v: 'opening ' + PHOTOS[pci].file + '...', dim: true }, { t: 'blank' }]);
                    } else {
                        printLines([{ t: 'blank' }, { t: 'img-reveal', src: PHOTOS[pci].src, width: '100%' }, { t: 'blank' }]);
                    }
                    return;
                }
            }
        }

        /* merch folder shortcut: typing a folder name cds into it */
        var isMerchContext = currentDir === 'merch' || currentDir === 'merch/segmentation' || currentDir === 'merch/stickers';
        if (isMerchContext) {
            var children = DIR_CHILDREN[currentDir] || [];
            if (children.indexOf(lower) !== -1) {
                printLines(COMMANDS['cd ' + lower]());
                return;
            }
        }

        var fn = COMMANDS[lower];
        if (fn) {
            printLines(fn());
        } else if (lower.indexOf('buy ') === 0 || (lower.indexOf('cat ') === 0 && lower !== 'cat readme.txt' && lower !== 'cat readme')) {
            var itemId = lower.replace(/^(buy|cat)\s+/, '').trim();
            printLines(openMerch(itemId));
        } else if (lower.indexOf('play ') === 0) {
            printLines(playTrack(lower.slice(5).trim()));
        } else if (lower === 'play') {
            output.appendChild(render({ t: 'error', v: "usage: play &lt;track name&gt;" }));
        } else if (lower.indexOf('lyrics ') === 0) {
            var lq = lower.slice(7).trim();
            var ltr = TRACKS.segmentation.find(function (t) { return t.id === lq || t.label.replace(/^\d+\s*-\s*/, '') === lq; });
            if (!ltr) {
                output.appendChild(render({ t: 'error', v: 'track not found: ' + esc(lq) }));
            } else {
                fetchLyrics(ltr);
            }
            output.appendChild(render({ t: 'blank' }));
            scrollBottom();
        } else {
            /* fuzzy match — auto-run closest command (skip for short inputs to avoid false matches on cd/ls) */
            var keys = Object.keys(COMMANDS);
            var best = null, bestDist = lower.length <= 2 ? 1 : 3;
            for (var ki = 0; ki < keys.length; ki++) {
                var d = levenshtein(lower, keys[ki]);
                if (d < bestDist) { bestDist = d; best = keys[ki]; }
            }
            if (best) {
                var hintEl = document.createElement('div');
                hintEl.className = 'out-text dim';
                hintEl.style.marginTop = '2px';
                hintEl.innerHTML = '\u2192 \'' + esc(best) + '\'';
                output.appendChild(hintEl);
                scrollBottom();
                execute(best, true);
            } else {
                output.appendChild(render({
                    t: 'error',
                    v: '\'' + esc(lower) + '\' not recognized. type \'help\' for available commands.'
                }));
                output.appendChild(render({ t: 'blank' }));
                scrollBottom();
            }
        }
    }

    /* ─── keyboard handling ────────────────────────────────── */

    input.addEventListener('keydown', function (e) {
        if (animating && e.key !== 'Tab') { e.preventDefault(); return; }
        if (e.key !== 'Tab') { tabCycle.partial = null; tabCycle.matches = []; tabCycle.index = -1; }

        switch (e.key) {

            case 'Enter':
                var val = input.value;
                if (val.trim()) {
                    cmdHistory.unshift(val);
                    historyPos = -1;
                }
                input.value = '';
                execute(val);
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (historyPos < cmdHistory.length - 1) {
                    historyPos++;
                    input.value = cmdHistory[historyPos];
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (historyPos > 0) {
                    historyPos--;
                    input.value = cmdHistory[historyPos];
                } else {
                    historyPos = -1;
                    input.value = '';
                }
                break;

            case 'Tab':
                e.preventDefault();
                var partial = input.value.toLowerCase().trim();
                if (!partial) break;
                if (partial.indexOf('play ') === 0) {
                    var tq = partial.slice(5);
                    var allTracks = TRACKS.segmentation.concat(TRACKS.sgmt_demos).concat(TRACKS.heel2_demos);
                    if (tabCycle.partial !== tq) {
                        tabCycle.partial = tq;
                        tabCycle.matches = allTracks.filter(function (t) { return t.id.indexOf(tq) === 0; });
                        tabCycle.index   = -1;
                    }
                    if (tabCycle.matches.length) {
                        tabCycle.index = (tabCycle.index + 1) % tabCycle.matches.length;
                        input.value = 'play ' + tabCycle.matches[tabCycle.index].id;
                    }
                } else if (partial.indexOf('open ') === 0) {
                    if (MEMBERS[currentDir] && 'photo.jpg'.indexOf(partial.slice(5)) === 0)
                        input.value = 'open photo.jpg';
                } else if (partial.indexOf('cat ') === 0 || partial.indexOf('buy ') === 0) {
                    var prefix = partial.slice(0, 4);
                    var mq = partial.slice(4);
                    if (MEMBERS[currentDir] && 'photo.jpg'.indexOf(mq) === 0) {
                        input.value = prefix + 'photo.jpg';
                    } else {
                        var mm = MERCH.filter(function (m) {
                            return m.id.indexOf(mq) === 0 || (m.label && m.label.indexOf(mq) === 0);
                        });
                        if (mm.length === 1) input.value = prefix + (mm[0].label || mm[0].id);
                    }
                } else {
                    if (MEMBERS[currentDir] && 'photo.jpg'.indexOf(partial) === 0) {
                        input.value = 'photo.jpg';
                    } else {
                        var matches = Object.keys(COMMANDS).filter(function (k) {
                            return k.indexOf(partial) === 0;
                        });
                        if (matches.length === 1) input.value = matches[0];
                    }
                }
                break;
        }
    });

    function focusInput() {
        if (window.innerWidth > 500) input.focus();
        else scrollBottom();
    }

    /* click anywhere in the terminal to focus the input */
    terminal.addEventListener('click', function () { focusInput(); });

    /* ─── desktop icons ───────────────────────────────────── */
    (function () {
        var termIcon = document.createElement('div');
        termIcon.className = 'desktop-icon';
        termIcon.id = 'desktop-icon-terminal';
        termIcon.innerHTML = '<div class="term-icon">&gt;_</div><span>terminal</span>';
        termIcon.addEventListener('dblclick', function () {
            ensureTerminalVisible();
        });
        desktopIconsEl.appendChild(termIcon);
    }());

    var desktopDirs = ['users', 'photo', 'video', 'music', 'merch'];
    desktopDirs.forEach(function (dir) {
        var icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.dataset.dir = dir;
        var iconDiv = dir === 'merch' ? 'globe-icon' : 'folder-icon';
        icon.innerHTML = dir === 'merch'
            ? '<div class="globe-icon"></div><div class="folder-icon mobile-merch-folder"></div><span>' + dir + '</span>'
            : '<div class="' + iconDiv + '"></div><span>' + dir + '</span>';
        icon.addEventListener('dblclick', function () {
            if (dir === 'music') {
                openExplorer('music');
                return;
            }
            if (dir === 'video') {
                openExplorer('video');
                return;
            }
            if (dir === 'merch') {
                openMerchBrowser();
                return;
            }
            if (dir === 'users') {
                openExplorer();
                return;
            }
            if (dir === 'photo') {
                openExplorer('photo');
                return;
            }
            skipToPrompt();
            currentDir = 'root';
            updatePrompt();
            execute('cd ' + dir);
        });
        desktopIconsEl.appendChild(icon);
    });

    function updateDesktopIcons() {
        var active = currentDir === 'root' ? null : currentDir.split('/')[0];
        desktopIconsEl.querySelectorAll('.desktop-icon').forEach(function (el) {
            el.classList.toggle('active', el.dataset.dir === active);
        });
    }

    /* ─── mobile home screen ──────────────────────────────── */
    function exitMobileHome() {
        document.body.classList.remove('mobile-home');
        windowEl = windowEl || document.querySelector('.window');
        windowEl.style.display = '';
        document.getElementById('task-heel').classList.add('active');
        focusInput();
    }

    /* build video overlay */
    /* mobile single-click handlers on desktop icons */
    desktopIconsEl.querySelectorAll('.desktop-icon').forEach(function (icon) {
        icon.addEventListener('click', function () {
            if (window.innerWidth > 900) return; /* desktop handles dblclick */
            var dir = icon.dataset.dir;
            if (!dir) { exitMobileHome(); return; } /* terminal icon */
            exitMobileHome();
            execute('cd ' + dir, false, true);
        });
    });

    /* mobile app shortcut icons */
    (function () {
        var rssIcon = '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="3" cy="11" r="1.5" fill="currentColor"/><path d="M2.5 7.5 Q6.5 7.5 6.5 11.5" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/><path d="M2.5 4.5 Q9.5 4.5 9.5 11.5" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/></svg>';
        var calIcon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="3" width="14" height="4" fill="currentColor" opacity="0.35"/><line x1="5" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="11" y1="1" x2="11" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
        var shortcuts = [
            { label: 'new',     cmd: 'fetch --new-releases',   icon: rssIcon  },
            { label: 'shows',   cmd: 'fetch --upcoming-shows',  icon: calIcon  },
            { label: 'stream',  cmd: 'fetch --streaming',       icon: '&#9835;' },
            { label: 'socials', cmd: 'fetch --socials',         icon: '<svg width="20" height="20" viewBox="0 0 20 20"><text x="10" y="15" text-anchor="middle" font-size="15" fill="currentColor" font-family="Arial, sans-serif">@</text></svg>' },
        ];
        var row = document.createElement('div');
        row.id = 'mobile-shortcuts';
        shortcuts.forEach(function (s) {
            var icon = document.createElement('div');
            icon.className = 'desktop-icon mobile-shortcut';
            icon.innerHTML = '<div class="shortcut-icon">' + s.icon + '</div><span>' + s.label + '</span>';
            icon.addEventListener('click', function () {
                if (window.innerWidth > 900) return;
                exitMobileHome();
                execute(s.cmd);
            });
            row.appendChild(icon);
        });
        document.body.appendChild(row);
    }());

    /* ─── minimize toggle ─────────────────────────────────── */
    var windowEl = document.querySelector('.window');
    document.getElementById('min-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.innerWidth <= 900) {
            skipToPrompt();
            windowEl.style.display = 'none';
            document.getElementById('task-heel').classList.remove('active');
            document.body.classList.add('mobile-home');
            currentDir = 'root';
            updateDesktopIcons();
        } else {
            toggleMinimize();
        }
    });
    document.querySelector('.title-bar').addEventListener('click', function () {
        if (dragMoved) { dragMoved = false; return; }
        if (windowEl.classList.contains('minimized')) setMinimized(false);
    });

    /* ─── maximize toggle ──────────────────────────────────── */
    document.getElementById('max-btn').addEventListener('click', function () {
        var maximized = document.body.classList.toggle('maximized');
        this.innerHTML = maximized ? '&#10064;' : '&#9633;';
        if (maximized) {
            windowEl.style.position = '';
            windowEl.style.left     = '';
            windowEl.style.top      = '';
        }
        scrollBottom();
    });

    /* ─── window dragging ─────────────────────────────────── */
    var isDragging  = false;
    var dragMoved   = false;
    var dragOffsetX = 0;
    var dragOffsetY = 0;

    document.querySelector('.title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        if (document.body.classList.contains('maximized')) return;

        // Snap to fixed positioning at current visual position
        if (!windowEl.style.left) {
            var rect = windowEl.getBoundingClientRect();
            windowEl.style.position = 'fixed';
            windowEl.style.left     = rect.left + 'px';
            windowEl.style.top      = rect.top  + 'px';
        }

        isDragging  = true;
        dragMoved   = false;
        dragOffsetX = e.clientX - windowEl.getBoundingClientRect().left;
        dragOffsetY = e.clientY - windowEl.getBoundingClientRect().top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        dragMoved = true;
        var x = e.clientX - dragOffsetX;
        var y = e.clientY - dragOffsetY;
        x = Math.max(0, Math.min(x, window.innerWidth  - windowEl.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - windowEl.offsetHeight));
        windowEl.style.left = x + 'px';
        windowEl.style.top  = y + 'px';
    });

    document.addEventListener('mouseup', function () {
        if (!isDragging) return;
        isDragging = false;
        document.body.classList.remove('dragging');
    });

    /* ─── jumpscare ────────────────────────────────────────── */
    var jumpscare = document.getElementById('jumpscare');

    function setWallpaper(src) {
        if (src) {
            document.body.style.backgroundImage    = 'url(' + src + ')';
            document.body.style.backgroundSize     = 'cover';
            document.body.style.backgroundPosition = 'center';
            localStorage.setItem('hl_wallpaper', src);
        } else {
            document.body.style.backgroundImage    = '';
            document.body.style.backgroundSize     = '';
            document.body.style.backgroundPosition = '';
            localStorage.removeItem('hl_wallpaper');
        }
    }

    (function () {
        var saved = localStorage.getItem('hl_wallpaper');
        if (saved) setWallpaper(saved);
    }());

    function triggerJumpscare() {
        var snd = new Audio('sounds/jumpscare.mp3');
        snd.play().catch(function () {});
        jumpscare.classList.add('active');
        setTimeout(function () {
            jumpscare.classList.remove('active');
        }, 1500);
    }

    document.getElementById('jumpscare-close').addEventListener('click', function (e) {
        e.stopPropagation();
        jumpscare.classList.remove('active');
    });
    jumpscare.addEventListener('click', function () {
        jumpscare.classList.remove('active');
    });

    document.getElementById('close-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.innerWidth <= 900) {
            skipToPrompt();
            windowEl.style.display = 'none';
            document.getElementById('task-heel').classList.remove('active');
            document.body.classList.add('mobile-home');
            currentDir = 'root';
            updateDesktopIcons();
        } else {
            windowEl.style.display = 'none';
            document.getElementById('task-heel').classList.remove('active');
        }
    });

    /* ─── startup: boot → welcome → clear → prompt ────────── */

    var bootSkipped = false;
    function skipToPrompt() {
        if (bootSkipped) return;
        bootSkipped = true;
        printGeneration++;
        output.innerHTML = '';
        animating = false;
        inputRow.style.visibility = 'visible';
        focusInput();
        var mobile = window.innerWidth <= 500;
        if (mobile) {
            execute('help');
        } else {
            var hint = render({ t: 'text', v: "type 'help' for a list of commands", dim: true });
            if (hint) output.appendChild(hint);
        }
    }

    document.addEventListener('keydown', function onBootEnter(e) {
        if (e.key !== 'Enter') return;
        document.removeEventListener('keydown', onBootEnter);
        skipToPrompt();
    });

    printLines(BOOT_LINES_PRE, function () {
        animating = true;
        inputRow.style.visibility = 'hidden';
        printLines(BOOT_LINES_POST, function () {
            animating = true;
            inputRow.style.visibility = 'hidden';
            printLines(WELCOME_LINES, function () {
                animating = true;
                inputRow.style.visibility = 'hidden';
                printLines([
                    { t: 'blank' },
                    { t: 'text', v: '-- WELCOME --', center: true, dim: true },
                ], function () {
                    var mobile = window.innerWidth <= 500;
                    var gateEl = document.createElement('div');
                    gateEl.className = 'out-text dim';
                    gateEl.style.textAlign = 'center';
                    gateEl.style.marginTop = '1em';
                    gateEl.innerHTML = mobile ? '[ tap here to continue ]' : '[ press any key ]';
                    if (mobile) gateEl.style.cursor = 'pointer';
                    output.appendChild(gateEl);
                    scrollBottom();
                    animating = false;

                    gateEl.addEventListener('click', skipToPrompt, { once: true });

                    document.addEventListener('keydown', function onKey(e) {
                        if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return;
                        e.preventDefault();
                        document.removeEventListener('keydown', onKey);
                        skipToPrompt();
                    });
                }, 60, 30);
            }, 60, 30);
        }, 70, 30);
    }, 70, 30);

    /* ─── helpers ──────────────────────────────────────────── */

    function levenshtein(a, b) {
        var m = a.length, n = b.length, dp = [], i, j;
        for (i = 0; i <= m; i++) {
            dp[i] = [i];
            for (j = 1; j <= n; j++) {
                dp[i][j] = i === 0 ? j
                    : a[i-1] === b[j-1] ? dp[i-1][j-1]
                    : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
            }
        }
        return dp[m][n];
    }

    function cdClear() { /* no-op: terminal keeps history on all devices */ }

    function fmtTime(s) {
        if (!s || isNaN(s)) return '0:00';
        var m = Math.floor(s / 60);
        var sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function updateNowPlaying(label) {
        var row = document.getElementById('nowplaying-row');
        if (!row) return;
        if (nowPlayingInterval) { clearInterval(nowPlayingInterval); nowPlayingInterval = null; }
        if (!label) { row.style.display = 'none'; return; }

        row.style.display = 'block';
        var span = row.querySelector('.nowplaying-text');

        function refresh() {
            if (!currentAudio) return;
            var cur = currentAudio.currentTime || 0;
            var dur = currentAudio.duration  || 0;
            var pct = dur > 0 ? cur / dur : 0;
            var blocks = window.innerWidth <= 500 ? 10 : 20;
            var filled = Math.round(pct * blocks);
            var bar = '[';
            for (var i = 0; i < blocks; i++) bar += i < filled ? '\u2588' : '\u2591';
            bar += ']';
            var text = '\u266a  ' + label + '  ' + bar + '  ' + fmtTime(cur) + ' / ' + fmtTime(dur);
            span.textContent = text;
            var ppBtn = document.getElementById('np-playpause');
            if (ppBtn) ppBtn.textContent = audioPaused ? '[play]' : '[pause]';
        }

        refresh();
        nowPlayingInterval = setInterval(refresh, 500);
    }

    /* ─── media player ────────────────────────────────────── */
    var playerWindowEl  = document.getElementById('player-window');
    var playerLcdTrack  = document.getElementById('player-lcd-track');
    var playerCurEl     = document.getElementById('player-cur');
    var playerDurEl     = document.getElementById('player-dur');
    var playerFill      = document.getElementById('player-progress-fill');
    var playerPlaylist  = document.getElementById('player-playlist');
    var playerPlayBtn   = document.getElementById('player-play');
    var playerTaskBtn   = null;

    function playerMakeItem(tr, idx) {
        var el = document.createElement('div');
        el.className = 'player-track-item';
        el.textContent = tr.label;
        el.addEventListener('dblclick', function () { playerPlayIndex(idx); });
        return el;
    }

    function playerBuildPlaylist() {
        playerPlaylist.innerHTML = '';
        if (playerCurrentAlbum === 'segmentation') {
            playerTrackList = TRACKS.segmentation.slice();
            playerTrackList.forEach(function (tr, i) {
                playerPlaylist.appendChild(playerMakeItem(tr, i));
            });
        } else {
            playerTrackList = [];
            var sections = [
                { label: '-- sgmt demos --', tracks: TRACKS.sgmt_demos },
                { label: '-- heel 2 demos --', tracks: TRACKS.heel2_demos },
            ];
            sections.forEach(function (sec) {
                var div = document.createElement('div');
                div.className = 'player-track-divider';
                div.textContent = sec.label;
                playerPlaylist.appendChild(div);
                sec.tracks.forEach(function (tr) {
                    var idx = playerTrackList.length;
                    playerTrackList.push(tr);
                    playerPlaylist.appendChild(playerMakeItem(tr, idx));
                });
            });
        }
        playerHighlightCurrent();
    }

    function playerHighlightCurrent() {
        var items = playerPlaylist.querySelectorAll('.player-track-item');
        items.forEach(function (el, i) {
            var isPlaying = i === playerTrackIndex && !!currentAudio;
            el.classList.toggle('playing', isPlaying);
        });
    }

    function playerPlayIndex(i) {
        if (i < 0 || i >= playerTrackList.length) return;
        var tr = playerTrackList[i];
        if (currentAudio) { currentAudio.pause(); }
        currentAudio = new Audio(tr.file);
        currentAudio.volume = masterVolume;
        currentAudio.muted  = masterMuted;
        audioPaused  = false;
        currentTrackLabel = tr.label;
        playerTrackIndex  = i;
        currentAudio.play().catch(function () {});
        updateNowPlaying(tr.label);
        currentAudio.addEventListener('ended', function () {
            currentAudio      = null;
            audioPaused       = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
            playerHighlightCurrent();
            // auto-advance
            if (i + 1 < playerTrackList.length) playerPlayIndex(i + 1);
        });
        playerHighlightCurrent();
    }

    function playerTick() {
        var cur = currentAudio ? (currentAudio.currentTime || 0) : 0;
        var dur = currentAudio ? (currentAudio.duration  || 0) : 0;
        var pct = dur > 0 ? (cur / dur) * 100 : 0;
        playerFill.style.width = pct + '%';
        playerCurEl.textContent = fmtTime(cur);
        playerDurEl.textContent = fmtTime(dur);
        if (currentTrackLabel) {
            playerLcdTrack.textContent = currentTrackLabel;
        } else {
            playerLcdTrack.textContent = '-- no track --';
        }
        playerPlayBtn.innerHTML = (currentAudio && !audioPaused)
            ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="display:block;margin:auto"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>'
            : '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="display:block;margin:auto"><polygon points="1,0 9,5 1,10"/></svg>';
        playerHighlightCurrent();
    }

    function openPlayer(trackId) {
        skipToPrompt();
        var initialLeft = Math.min(window.innerWidth - 310, Math.max(window.innerWidth / 2 + 340, 20));
        var initialTop  = 60;
        playerWindowEl.style.left    = initialLeft + 'px';
        playerWindowEl.style.top     = initialTop  + 'px';
        playerWindowEl.style.display = 'block';
        vlcBringToFront('player');
        playerMinimized = false;
        if (trackId) {
            var isDemos = TRACKS.sgmt_demos.concat(TRACKS.heel2_demos).some(function (t) { return t.id === trackId; });
            var album = isDemos ? 'demos' : 'segmentation';
            playerCurrentAlbum = album;
            document.getElementById('player-tabs').querySelectorAll('.player-tab').forEach(function (t) {
                t.classList.toggle('active', t.dataset.album === album);
            });
        }
        playerBuildPlaylist();
        if (trackId) {
            var idx = playerTrackList.findIndex(function (t) { return t.id === trackId; });
            if (idx !== -1) {
                var item = playerPlaylist.querySelectorAll('.player-track-item')[idx];
                if (item) item.scrollIntoView({ block: 'nearest' });
            }
        }
        if (playerUpdateIv) clearInterval(playerUpdateIv);
        playerUpdateIv = setInterval(playerTick, 500);
        playerTick();
        if (!playerTaskBtn) {
            playerTaskBtn = document.createElement('button');
            playerTaskBtn.className = 'task-btn active';
            playerTaskBtn.textContent = 'weltamp.exe';
            playerTaskBtn.addEventListener('click', function () {
                if (playerMinimized) {
                    playerWindowEl.classList.remove('minimized');
                    playerMinimized = false;
                    playerTaskBtn.classList.add('active');
                } else {
                    playerWindowEl.classList.add('minimized');
                    playerMinimized = true;
                    playerTaskBtn.classList.remove('active');
                }
            });
            document.getElementById('taskbar-tasks').appendChild(playerTaskBtn);
        }
    }

    function closePlayer() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            audioPaused = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
        }
        playerWindowEl.style.display = 'none';
        if (playerUpdateIv) { clearInterval(playerUpdateIv); playerUpdateIv = null; }
        if (playerTaskBtn) { playerTaskBtn.remove(); playerTaskBtn = null; }
    }

    /* now-playing bar controls (mobile) */
    document.getElementById('np-playpause').addEventListener('click', function () {
        if (!currentAudio) return;
        if (audioPaused) {
            currentAudio.play().catch(function () {});
            audioPaused = false;
            this.textContent = '[pause]';
        } else {
            currentAudio.pause();
            audioPaused = true;
            this.textContent = '[play]';
        }
    });
    document.getElementById('np-stop').addEventListener('click', function () {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            audioPaused = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
        }
    });

    /* player controls */
    document.getElementById('player-close-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        closePlayer();
    });
    document.getElementById('player-min-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        playerMinimized = !playerMinimized;
        playerWindowEl.classList.toggle('minimized', playerMinimized);
        if (playerTaskBtn) playerTaskBtn.classList.toggle('active', !playerMinimized);
    });
    document.getElementById('player-play').addEventListener('click', function () {
        if (!currentAudio) {
            if (playerTrackList.length > 0) playerPlayIndex(Math.max(playerTrackIndex, 0));
        } else if (audioPaused) {
            currentAudio.play().catch(function () {});
            audioPaused = false;
        } else {
            currentAudio.pause();
            audioPaused = true;
        }
        playerTick();
    });
    document.getElementById('player-stop').addEventListener('click', function () {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio      = null;
            audioPaused       = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
            playerTick();
        }
    });
    document.getElementById('player-prev').addEventListener('click', function () {
        if (playerTrackIndex > 0) playerPlayIndex(playerTrackIndex - 1);
    });
    document.getElementById('player-next').addEventListener('click', function () {
        if (playerTrackIndex < playerTrackList.length - 1) playerPlayIndex(playerTrackIndex + 1);
    });

    /* seek on progress bar click */
    document.getElementById('player-progress-wrap').addEventListener('click', function (e) {
        if (!currentAudio || !currentAudio.duration) return;
        var rect = this.getBoundingClientRect();
        var pct  = (e.clientX - rect.left) / rect.width;
        currentAudio.currentTime = pct * currentAudio.duration;
        playerTick();
    });

    /* album tabs */
    document.getElementById('player-tabs').addEventListener('click', function (e) {
        var tab = e.target.closest('.player-tab');
        if (!tab) return;
        playerCurrentAlbum = tab.dataset.album;
        playerTrackIndex   = -1;
        this.querySelectorAll('.player-tab').forEach(function (t) {
            t.classList.toggle('active', t === tab);
        });
        playerBuildPlaylist();
    });

    /* player window dragging */
    var playerDragging  = false;
    var playerDragOffX  = 0;
    var playerDragOffY  = 0;
    document.getElementById('player-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        playerDragging = true;
        playerDragOffX = e.clientX - playerWindowEl.getBoundingClientRect().left;
        playerDragOffY = e.clientY - playerWindowEl.getBoundingClientRect().top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!playerDragging) return;
        var x = Math.max(0, Math.min(e.clientX - playerDragOffX, window.innerWidth  - playerWindowEl.offsetWidth));
        var y = Math.max(0, Math.min(e.clientY - playerDragOffY, window.innerHeight - playerWindowEl.offsetHeight));
        playerWindowEl.style.left = x + 'px';
        playerWindowEl.style.top  = y + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!playerDragging) return;
        playerDragging = false;
        document.body.classList.remove('dragging');
    });

    /* ─── vlc media player ────────────────────────────────── */
    vlcWindowEl = document.getElementById('vlc-window');

    function extractYouTubeId(url) { // also called from dirListing — must stay hoisted
        var m = url.match(/[?&]v=([^&]+)/);
        if (m) return m[1];
        m = url.match(/youtu\.be\/([^?&]+)/);
        if (m) return m[1];
        return null;
    }

    function vlcFmtTitle(id) {
        return id.replace(/_/g, ' ');
    }

    function vlcOnStateChange(event) {
        var playBtn = document.getElementById('vlc-play-btn');
        if (event.data === YT.PlayerState.PLAYING) {
            if (!vlcUpdateIv) vlcUpdateIv = setInterval(vlcTick, 500);
            if (playBtn) playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="display:block;margin:auto"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>';
        } else {
            if (vlcUpdateIv) { clearInterval(vlcUpdateIv); vlcUpdateIv = null; }
            if (playBtn) playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="display:block;margin:auto"><polygon points="1,0 9,5 1,10"/></svg>';
            vlcTick();
        }
    }

    function vlcTick() {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        var cur = ytPlayer.getCurrentTime() || 0;
        var dur = ytPlayer.getDuration()    || 0;
        var pct = dur > 0 ? (cur / dur) * 100 : 0;
        document.getElementById('vlc-progress-fill').style.width = pct + '%';
        document.getElementById('vlc-cur').textContent = fmtTime(Math.floor(cur));
        document.getElementById('vlc-dur').textContent = fmtTime(Math.floor(dur));
    }

    function vlcCreatePlayer(videoId, title) {
        document.getElementById('vlc-no-media').style.display = 'none';
        vlcWindowEl.querySelector('.title-bar-text').textContent = 'HLC —' + vlcFmtTitle(title || videoId);
        ytPlayer = new YT.Player('vlc-yt-player', {
            host:    'https://www.youtube-nocookie.com',
            height: '100%',
            width:  '100%',
            videoId: videoId,
            playerVars: { rel: 0, controls: 0, autoplay: 1 },
            events: { onStateChange: vlcOnStateChange }
        });
    }

    function vlcLoadVideo(videoId, title) {
        document.getElementById('vlc-no-media').style.display = 'none';
        vlcWindowEl.querySelector('.title-bar-text').textContent = 'HLC —' + vlcFmtTitle(title || videoId);
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
        } else if (ytApiReady) {
            vlcCreatePlayer(videoId, title);
        } else {
            vlcPendingId    = videoId;
            vlcPendingTitle = title;
        }
    }

    function openVlc(videoId, title) {
        skipToPrompt();
        vlcWindowEl.style.display = 'block';
        vlcMinimized = false;
        vlcWindowEl.classList.remove('minimized');
        vlcBringToFront('vlc');
        if (!vlcWindowEl.style.left) {
            vlcWindowEl.style.left = '20px';
            vlcWindowEl.style.top  = Math.min(Math.floor(window.innerHeight * 0.5), window.innerHeight - 370) + 'px';
        }
        if (!vlcTaskBtn) {
            vlcTaskBtn = document.createElement('button');
            vlcTaskBtn.className   = 'task-btn active';
            vlcTaskBtn.textContent = 'HLC.exe';
            vlcTaskBtn.addEventListener('click', function () {
                vlcMinimized = !vlcMinimized;
                vlcWindowEl.classList.toggle('minimized', vlcMinimized);
                vlcTaskBtn.classList.toggle('active', !vlcMinimized);
            });
            document.getElementById('taskbar-tasks').appendChild(vlcTaskBtn);
        } else {
            vlcTaskBtn.classList.add('active');
        }
        if (videoId) vlcLoadVideo(videoId, title);
    }

    function closeVlc() {
        vlcWindowEl.style.display = 'none';
        if (vlcUpdateIv) { clearInterval(vlcUpdateIv); vlcUpdateIv = null; }
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();
        if (vlcTaskBtn) { vlcTaskBtn.remove(); vlcTaskBtn = null; }
    }

    document.getElementById('vlc-close-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        closeVlc();
    });
    document.getElementById('vlc-min-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        vlcMinimized = !vlcMinimized;
        vlcWindowEl.classList.toggle('minimized', vlcMinimized);
        if (vlcTaskBtn) vlcTaskBtn.classList.toggle('active', !vlcMinimized);
    });
    document.getElementById('vlc-play-btn').addEventListener('click', function () {
        if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
        var state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            ytPlayer.pauseVideo();
        } else {
            ytPlayer.playVideo();
        }
    });
    document.getElementById('vlc-stop-btn').addEventListener('click', function () {
        if (!ytPlayer || typeof ytPlayer.stopVideo !== 'function') return;
        ytPlayer.stopVideo();
        document.getElementById('vlc-progress-fill').style.width = '0%';
        document.getElementById('vlc-cur').textContent = '0:00';
    });
    document.getElementById('vlc-rewind').addEventListener('click', function () {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10), true);
        vlcTick();
    });
    document.getElementById('vlc-ffwd').addEventListener('click', function () {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
        ytPlayer.seekTo(ytPlayer.getCurrentTime() + 10, true);
        vlcTick();
    });
    document.getElementById('vlc-progress-wrap').addEventListener('click', function (e) {
        if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return;
        var rect = this.getBoundingClientRect();
        ytPlayer.seekTo((e.clientX - rect.left) / rect.width * ytPlayer.getDuration(), true);
        vlcTick();
    });

    /* vlc dragging */
    var vlcDragging = false, vlcDragOffX = 0, vlcDragOffY = 0;
    document.getElementById('vlc-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        vlcDragging = true;
        vlcDragOffX = e.clientX - vlcWindowEl.getBoundingClientRect().left;
        vlcDragOffY = e.clientY - vlcWindowEl.getBoundingClientRect().top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!vlcDragging) return;
        vlcWindowEl.style.left = Math.max(0, Math.min(e.clientX - vlcDragOffX, window.innerWidth  - vlcWindowEl.offsetWidth))  + 'px';
        vlcWindowEl.style.top  = Math.max(0, Math.min(e.clientY - vlcDragOffY, window.innerHeight - vlcWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!vlcDragging) return;
        vlcDragging = false;
        document.body.classList.remove('dragging');
    });

    /* ─── merch browser ───────────────────────────────────── */
    var merchWindowEl  = document.getElementById('merch-window');
    var merchIeBody    = document.getElementById('merch-ie-body');
    var merchAddress   = document.getElementById('merch-address');
    var merchBackBtn   = document.getElementById('merch-back-btn');
    var merchFwdBtn    = document.getElementById('merch-fwd-btn');
    var merchHomeBtn   = document.getElementById('merch-home-btn');
    var merchBrowserView = 'grid';
    var merchBrowserIdx  = 0;
    var merchMinimized   = false;
    var merchTaskBtn     = null;

    function merchDisplayName(id) {
        return id.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function renderMerchGrid() {
        merchBrowserView = 'grid';
        merchIeBody.style.overflow = '';
        merchAddress.value = 'http://www.heelband.com/store/';
        merchBackBtn.disabled = true;
        merchFwdBtn.disabled  = true;
        merchHomeBtn.disabled = true;
        var html = '<div class="merch-page">'
            + '<div class="merch-page-header">&#9733; HEEL OFFICIAL MERCHANDISE &#9733;</div>'
            + '<div class="merch-page-subheader">CLICK AN ITEM TO VIEW &nbsp;|&nbsp; SECURE CHECKOUT VIA SQUARE</div>'
            + '<hr class="merch-page-hr">'
            + '<div class="merch-grid">';
        for (var i = 0; i < MERCH.length; i++) {
            var displayName = MERCH[i].label ? merchDisplayName(MERCH[i].label) : merchDisplayName(MERCH[i].id);
            html += '<div class="merch-grid-item" data-idx="' + i + '">'
                + '<img class="merch-grid-photo" src="' + MERCH[i].photo + '" alt="' + displayName + '">'
                + '<div class="merch-grid-name">' + displayName + '</div>'
                + '<div class="merch-grid-price">' + MERCH[i].price + '</div>'
                + '</div>';
        }
        html += '</div>'
            + '<div class="merch-page-footer">&copy; 2023 HEEL CORP. ALL RIGHTS RESERVED &nbsp;|&nbsp; BEST VIEWED IN INTERNET EXPLORER 5.5 AT 800&times;600</div>'
            + '</div>';
        merchIeBody.innerHTML = html;
        merchIeBody.querySelectorAll('.merch-grid-item').forEach(function (el) {
            el.addEventListener('click', function () {
                renderMerchItem(parseInt(el.dataset.idx));
            });
        });
    }

    function renderMerchItem(idx) {
        merchBrowserView = 'item';
        merchBrowserIdx  = idx;
        var item = MERCH[idx];
        /* NOTE: Square checkout URLs are set in the MERCH array near the top of this script — update them there */
        merchAddress.value = 'http://www.heelband.com/store/' + (item.label || item.id) + '.html';
        merchBackBtn.disabled = (idx === 0);
        merchFwdBtn.disabled  = (idx === MERCH.length - 1);
        merchHomeBtn.disabled = false;
        var html = '<div class="merch-page">'
            + '<div class="merch-page-header">&#9733; HEEL OFFICIAL MERCHANDISE &#9733;</div>'
            + '<hr class="merch-page-hr">'
            + '<div class="merch-item-view">'
            + '<img class="merch-item-photo" src="' + item.photo + '" alt="' + merchDisplayName(item.label || item.id) + '">'
            + '<div class="merch-item-name">' + merchDisplayName(item.label || item.id) + '</div>'
            + '<div class="merch-item-price">' + item.price + '</div>'
            + (item.href ? '<a class="merch-buy-btn" href="' + item.href + '" target="_blank" rel="noopener">BUY NOW</a>' : '')
            + '</div>'
            + '<div class="merch-page-footer">&copy; 2023 HEEL CORP. ALL RIGHTS RESERVED &nbsp;|&nbsp; BEST VIEWED IN INTERNET EXPLORER 5.5 AT 800&times;600</div>'
            + '</div>';
        merchIeBody.innerHTML = html;
        merchIeBody.scrollTop = 0;
    }

    function openMerchBrowser() {
        if (merchWindowEl.style.display !== 'block') {
            var mw = 720, mh = 530;
            merchWindowEl.style.left = Math.max(20, window.innerWidth  - mw - 20) + 'px';
            merchWindowEl.style.top  = Math.max(40, window.innerHeight - mh - 56) + 'px';
            merchWindowEl.style.display = 'block';
            merchMinimized = false;
            merchWindowEl.classList.remove('minimized');
            renderMerchGrid();
        } else {
            merchWindowEl.style.display = 'block';
            merchMinimized = false;
            merchWindowEl.classList.remove('minimized');
        }
        if (!merchTaskBtn) {
            merchTaskBtn = document.createElement('button');
            merchTaskBtn.className = 'task-btn active';
            merchTaskBtn.textContent = 'iexplore.exe';
            merchTaskBtn.addEventListener('click', function () {
                merchMinimized = !merchMinimized;
                merchWindowEl.classList.toggle('minimized', merchMinimized);
                merchTaskBtn.classList.toggle('active', !merchMinimized);
            });
            document.getElementById('taskbar-tasks').appendChild(merchTaskBtn);
        }
        vlcBringToFront('merch');
    }

    merchBackBtn.addEventListener('click', function () {
        if (merchBrowserIdx > 0) renderMerchItem(merchBrowserIdx - 1);
    });
    merchFwdBtn.addEventListener('click', function () {
        if (merchBrowserIdx < MERCH.length - 1) renderMerchItem(merchBrowserIdx + 1);
    });
    merchHomeBtn.addEventListener('click', function () {
        renderMerchGrid();
    });
    document.getElementById('merch-min-btn').addEventListener('click', function () {
        merchMinimized = !merchMinimized;
        merchWindowEl.classList.toggle('minimized', merchMinimized);
        if (merchTaskBtn) merchTaskBtn.classList.toggle('active', !merchMinimized);
    });
    document.getElementById('merch-close-btn').addEventListener('click', function () {
        merchWindowEl.style.display = 'none';
        merchMinimized = false;
        merchWindowEl.classList.remove('minimized');
        if (merchTaskBtn) { merchTaskBtn.remove(); merchTaskBtn = null; }
    });

    /* ── merch address bar game ── */
    (function () {
        var titleEl = document.querySelector('#merch-title-bar .title-bar-text');

        function renderDinoGame() {
            merchIeBody.innerHTML = '';
            if (titleEl) titleEl.textContent = 'Cannot find server \u2014 Internet Explorer';

            var W = merchIeBody.offsetWidth  || 680;
            var H = merchIeBody.offsetHeight || 390;

            var canvas = document.createElement('canvas');
            canvas.width  = W;
            canvas.height = H;
            canvas.style.cssText = 'display:block;cursor:pointer;';
            merchIeBody.appendChild(canvas);

            var ctx = canvas.getContext('2d');

            var GRAVITY  = 4200;
            var JUMP_VEL = -800;
            var BASE_SPD = 140;
            var RAMP     = 28;
            var GROUND_Y = H - 48;
            var PW = 34, PH = 38;
            var PX = 70;

            /* clouds — each: { x, y, w, h } */
            var clouds = [];
            for (var ci = 0; ci < 5; ci++) {
                clouds.push({
                    x: Math.random() * W,
                    y: 18 + Math.random() * (GROUND_Y * 0.35),
                    w: 48 + Math.random() * 60,
                    h: 16 + Math.random() * 14
                });
            }

            /* buildings — city silhouette, slow parallax */
            var buildings = [];
            (function () {
                var bx = 0;
                while (bx < W * 1.8) {
                    var bw = 28 + Math.floor(Math.random() * 62);
                    var bh = 45 + Math.floor(Math.random() * (GROUND_Y * 0.72));
                    buildings.push({ x: bx, w: bw, h: bh });
                    bx += bw + Math.floor(Math.random() * 6);
                }
            }());

            var s = {
                py: GROUND_Y, pvy: 0, onGround: true,
                obs: [], speed: BASE_SPD, score: 0,
                started: false, over: false,
                spawnT: 1.5, lastTs: null, raf: null
            };

            function reset() {
                s.py = GROUND_Y; s.pvy = 0; s.onGround = true;
                s.obs = []; s.speed = BASE_SPD; s.score = 0;
                s.started = false; s.over = false; s.spawnT = 1.5; s.lastTs = null;
                if (titleEl) titleEl.textContent = 'Cannot find server \u2014 Internet Explorer';
            }

            function jump() {
                if (s.over) { reset(); return; }
                if (!s.started) s.started = true;
                if (s.onGround) { s.pvy = JUMP_VEL; s.onGround = false; }
            }

            function update(dt) {
                if (!s.started || s.over) return;
                s.score += dt;
                s.speed = BASE_SPD + s.score * RAMP;

                /* buildings at 8% speed */
                var bldgSpd = s.speed * 0.08;
                var maxBX = 0;
                for (var bi = 0; bi < buildings.length; bi++) {
                    buildings[bi].x -= bldgSpd * dt;
                    if (buildings[bi].x + buildings[bi].w > maxBX) maxBX = buildings[bi].x + buildings[bi].w;
                }
                for (var bi2 = 0; bi2 < buildings.length; bi2++) {
                    if (buildings[bi2].x + buildings[bi2].w < 0) {
                        buildings[bi2].x = maxBX + Math.floor(Math.random() * 6);
                        buildings[bi2].w = 28 + Math.floor(Math.random() * 62);
                        buildings[bi2].h = 45 + Math.floor(Math.random() * (GROUND_Y * 0.72));
                        maxBX = buildings[bi2].x + buildings[bi2].w;
                    }
                }

                /* clouds scroll at 25% of obstacle speed */
                var cloudSpd = s.speed * 0.25;
                for (var ci = 0; ci < clouds.length; ci++) {
                    clouds[ci].x -= cloudSpd * dt;
                    if (clouds[ci].x + clouds[ci].w < 0) {
                        clouds[ci].x = W + Math.random() * 80;
                        clouds[ci].y = 18 + Math.random() * (GROUND_Y * 0.35);
                        clouds[ci].w = 48 + Math.random() * 60;
                        clouds[ci].h = 16 + Math.random() * 14;
                    }
                }

                s.pvy += GRAVITY * dt;
                s.py  += s.pvy * dt;
                if (s.py >= GROUND_Y) { s.py = GROUND_Y; s.pvy = 0; s.onGround = true; }

                s.spawnT -= dt;
                if (s.spawnT <= 0) {
                    var variant = Math.floor(Math.random() * 4);

                    var w = 18 + Math.floor(Math.random() * 6);
                    var h = 34 + Math.floor(Math.random() * 6);

                    s.obs.push({ 
                        x: W + 10, 
                        w: w, 
                        h: h, 
                        type: 'person',
                        variant: variant
                    });

                    s.spawnT = 0.8 + Math.random() * 0.9;
                }

                for (var i = s.obs.length - 1; i >= 0; i--) {
                    var o = s.obs[i];
                    o.x -= s.speed * dt;
                    if (o.x + o.w < 0) { s.obs.splice(i, 1); continue; }
                    var m = 5, oy = GROUND_Y - o.h;
                    if (PX + PW - m > o.x + m && PX + m < o.x + o.w - m &&
                        s.py - PH + m < oy + o.h && s.py - m > oy) {
                        s.over = true;
                        if (titleEl) titleEl.textContent = 'GAME OVER \u2014 Score: ' + Math.floor(s.score * 10) + ' \u2014 Internet Explorer';
                    }
                }
            }

            function drawCloud(c) {
                ctx.fillStyle = '#e8e8e8';
                ctx.beginPath();
                ctx.ellipse(c.x + c.w * 0.5, c.y + c.h * 0.6, c.w * 0.5, c.h * 0.4, 0, 0, Math.PI * 2);
                ctx.ellipse(c.x + c.w * 0.3, c.y + c.h * 0.55, c.w * 0.28, c.h * 0.45, 0, 0, Math.PI * 2);
                ctx.ellipse(c.x + c.w * 0.7, c.y + c.h * 0.5, c.w * 0.24, c.h * 0.38, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            function drawPlayer() {
                var bx = PX, by = s.py - PH;
                var col = s.over ? '#888' : '#2a2a2a';

                ctx.save();
                ctx.translate(bx, by);

                /* ── boot silhouette ── */
                ctx.beginPath();
                ctx.moveTo(4, 0);      // shaft top-left
                ctx.lineTo(17, 0);     // shaft top-right
                ctx.lineTo(17, 20);    // shaft base
                ctx.lineTo(30, 26);    // vamp slopes forward
                ctx.lineTo(34, 32);    // toe tip
                ctx.lineTo(34, 38);    // toe front-bottom (ground)
                ctx.lineTo(20, 38);    // toe sole back
                ctx.lineTo(15, 32);    // notch peak (triangle tip)
                ctx.lineTo(10, 38);    // notch back to ground
                ctx.lineTo(4,  38);    // heel back — flush with shaft, no jut
                ctx.lineTo(4,  0);     // back up shaft
                ctx.closePath();
                ctx.fillStyle = col;
                ctx.fill();

                /* ── shaft shine ── */
                ctx.fillStyle = s.over ? '#aaa' : '#484848';
                ctx.fillRect(5, 2, 2, 18);

                /* ── buckle strap ── */
                ctx.fillStyle = s.over ? '#555' : '#222';
                ctx.fillRect(5, 12, 11, 3);
                ctx.strokeStyle = s.over ? '#888' : '#c0c0c0';
                ctx.lineWidth = 1;
                ctx.strokeRect(5, 11, 5, 5);
                ctx.fillStyle = s.over ? '#888' : '#c0c0c0';
                ctx.fillRect(8, 13, 1, 1);

                ctx.restore();
            }

            function drawPerson(o) {
                var x = o.x;
                var y = GROUND_Y;

                ctx.save();
                ctx.translate(x, y);

                var skin, hair, shirt;

                // 4 variants
                if (o.variant === 0) {
                    // harsh
                    skin = '#70533a';
                    hair = '#111';
                    shirt = '#161616';
                } else if (o.variant === 1) {
                    // nick
                    skin = '#e0d3bf';
                    hair = '#c58150';
                    shirt = '#aeaeae';
                } else if (o.variant === 2) {
                    // andres
                    skin = '#ddc39c';
                    hair = '#5a3a1b';
                    shirt = '#27512c';
                } else {
                    // tayla
                    skin = '#d4a879';
                    hair = '#ff4ca5';
                    shirt = '#000000';
                }

                var h = o.h;

                // BODY
                ctx.fillStyle = shirt;
                ctx.fillRect(4, -h * 0.6, 10, h * 0.4);

                // LEGS
                ctx.fillStyle = '#222';
                ctx.fillRect(4, -h * 0.2, 4, h * 0.2);
                ctx.fillRect(10, -h * 0.2, 4, h * 0.2);

                // HEAD
                ctx.fillStyle = skin;
                ctx.beginPath();
                ctx.arc(9, -h * 0.75, 6, 0, Math.PI * 2);
                ctx.fill();

                // HAIR
                ctx.fillStyle = hair;
                ctx.fillRect(3, -h * 0.9, 12, 5);


                // LONG HAIR variants (andres, nick variants)
                if (o.variant > 0 ) {
                    ctx.fillRect(3, -h * 0.75, 3, 10);
                    ctx.fillRect(12, -h * 0.75, 3, 10);
                }

                // BRAIDS (tayla variant)
                // if (o.variant === 3) {
                //     // pink braids
                //     ctx.fillStyle = '#ff4ca5';
                //     ctx.fillRect(2, -h * 0.7, 3, 10);
                //     ctx.fillRect(13, -h * 0.7, 3, 10);

                //     // blue tips
                //     ctx.fillStyle = '#ff4ca5';
                //     ctx.fillRect(2, -h * 0.6, 3, 4);
                //     ctx.fillRect(13, -h * 0.6, 3, 4);
                // }

                ctx.restore();
            }

            function draw() {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, W, H);

/* buildings — flat gray silhouettes */
                ctx.fillStyle = '#d0d0d0';
                for (var bi = 0; bi < buildings.length; bi++) {
                    var b = buildings[bi];
                    ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
                }

                /* clouds */
                for (var ci = 0; ci < clouds.length; ci++) drawCloud(clouds[ci]);

                /* sidewalk */
                ctx.fillStyle = '#909090';
                ctx.fillRect(0, GROUND_Y, W, 1);
                ctx.fillStyle = '#b4b4b4';
                ctx.fillRect(0, GROUND_Y + 1, W, H - GROUND_Y - 1);

                for (var i = 0; i < s.obs.length; i++) {
                    var o = s.obs[i];
                    drawPerson(o);
                }

                drawPlayer();

                ctx.fillStyle = '#000';
                ctx.font = '12px "Courier New"';
                ctx.textAlign = 'right';
                ctx.fillText('SCORE ' + Math.floor(s.score * 10), W - 12, 20);

                function dialog(lines) {
                    var bw = 310, bh = 18 + lines.length * 20 + 12;
                    var bx = W / 2 - bw / 2, by = H / 2 - bh / 2 - 10;
                    ctx.fillStyle = '#c0c0c0';
                    ctx.fillRect(bx, by, bw, bh);
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
                    ctx.strokeRect(bx, by, bw, bh);
                    ctx.strokeStyle = '#808080';
                    ctx.strokeRect(bx + 1, by + 1, bw, bh);
                    ctx.textAlign = 'center';
                    for (var li = 0; li < lines.length; li++) {
                        ctx.fillStyle = '#000';
                        ctx.font = li === 0 ? 'bold 13px "Courier New"' : '12px "Courier New"';
                        ctx.fillText(lines[li], W / 2, by + 18 + li * 20);
                    }
                }

                if (!s.started && !s.over) {
                    dialog(['404 — Page Not Found', 'PRESS SPACE OR CLICK TO START']);
                }
                if (s.over) {
                    dialog([
                        'GAME OVER',
                        'SCORE: ' + Math.floor(s.score * 10),
                        'PRESS SPACE OR CLICK TO RESTART'
                    ]);
                }
            }

            function loop(ts) {
                if (s.lastTs !== null) {
                    var dt = Math.min((ts - s.lastTs) / 1000, 0.05);
                    update(dt);
                }
                s.lastTs = ts;
                draw();
                s.raf = requestAnimationFrame(loop);
            }

            function onKey(e) {
                if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
            }
            document.addEventListener('keydown', onKey);
            canvas.addEventListener('click', jump);
            canvas.addEventListener('touchstart', function (e) { e.preventDefault(); jump(); }, { passive: false });

            var mo = new MutationObserver(function () {
                if (!merchIeBody.contains(canvas)) {
                    cancelAnimationFrame(s.raf);
                    document.removeEventListener('keydown', onKey);
                    if (titleEl) titleEl.textContent = 'HEEL Online Store \u2014 Internet Explorer';
                    mo.disconnect();
                }
            });
            mo.observe(merchIeBody, { childList: true });

            s.raf = requestAnimationFrame(loop);
        }

        merchAddress.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var val = merchAddress.value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
            if (val === 'heelglobal.com' || val === 'www.heelglobal.com') {
                if (window !== window.top) {
                    renderDinoGame();
                } else {
                    merchIeBody.innerHTML = '';
                    if (titleEl) titleEl.textContent = 'heelglobal.com \u2014 Internet Explorer';
                    merchIeBody.style.overflow = 'hidden';
                    var scale = 0.65;
                    var iw = Math.round(merchIeBody.offsetWidth / scale);
                    var ih = Math.round(merchIeBody.offsetHeight / scale);
                    var frame = document.createElement('iframe');
                    frame.src = 'index.html';
                    frame.style.cssText = 'width:' + iw + 'px;height:' + ih + 'px;border:none;display:block;transform:scale(' + scale + ');transform-origin:top left;';
                    merchIeBody.appendChild(frame);
                }
            } else {
                renderDinoGame();
            }
            merchAddress.blur();
        });
    }());

    /* merch window dragging */
    var merchDragging = false, merchDragOffX = 0, merchDragOffY = 0;
    document.getElementById('merch-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        vlcBringToFront('merch');
        merchDragging = true;
        merchDragOffX = e.clientX - merchWindowEl.getBoundingClientRect().left;
        merchDragOffY = e.clientY - merchWindowEl.getBoundingClientRect().top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!merchDragging) return;
        merchWindowEl.style.left = Math.max(0, Math.min(e.clientX - merchDragOffX, window.innerWidth  - merchWindowEl.offsetWidth))  + 'px';
        merchWindowEl.style.top  = Math.max(0, Math.min(e.clientY - merchDragOffY, window.innerHeight - merchWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!merchDragging) return;
        merchDragging = false;
        document.body.classList.remove('dragging');
    });

    /* ─── windows explorer (users) ───────────────────────── */
    var explorerWindowEl  = document.getElementById('explorer-window');
    var explorerBodyEl    = document.getElementById('explorer-body');
    var explorerAddressEl = document.getElementById('explorer-address');
    var explorerTitleEl   = document.getElementById('explorer-title-text');
    var explorerBackBtn   = document.getElementById('explorer-back-btn');
    var explorerStatusEl  = document.getElementById('explorer-status');
    var explorerMinimized   = false;
    var explorerTaskBtn     = null;
    var explorerCurrentView = null;
    var explorerDragging  = false, explorerDragOffX = 0, explorerDragOffY = 0;

    var MEMBER_NAMES = Object.keys(MEMBERS);

    function getMemberFiles(name) {
        var m = MEMBERS[name];
        var files = [{ name: 'photo.jpg', type: 'img', cmd: 'photo.jpg' },
                     { name: 'profile.txt', type: 'txt', cmd: 'profile' }];
        if (m.gear) files.push({ name: 'gear.txt', type: 'txt', cmd: 'gear' });
        if (m.data) files.push({ name: 'data.txt', type: 'txt', cmd: 'data' });
        return files;
    }

    function explorerRenderUsers() {
        explorerCurrentView = 'users';
        explorerBodyEl.innerHTML = '';
        MEMBER_NAMES.forEach(function (name) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            icon.innerHTML = '<div class="expl-folder"></div><span>' + name + '</span>';
            icon.addEventListener('dblclick', function () { execute('cd ' + name, false, true); });
            explorerBodyEl.appendChild(icon);
        });
        explorerAddressEl.textContent = 'C:\\heel\\users\\';
        explorerTitleEl.textContent   = 'users - File Explorer';
        explorerStatusEl.textContent  = MEMBER_NAMES.length + ' objects';
        explorerBackBtn.disabled = true;
    }

    function explorerRenderMember(name) {
        explorerCurrentView = name;
        var files = getMemberFiles(name);
        explorerBodyEl.innerHTML = '';
        files.forEach(function (f) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            var fdot = f.name.lastIndexOf('.');
            var fbase = fdot >= 0 ? f.name.slice(0, fdot) : f.name;
            var fext  = fdot >= 0 ? f.name.slice(fdot) : '';
            icon.innerHTML = '<div class="' + (f.type === 'img' ? 'expl-file-img' : 'expl-file-txt') + '"></div><span>' + fbase.replace(/_/g, '_<wbr>') + '<span style="white-space:nowrap">' + fext + '</span></span>';
            icon.addEventListener('dblclick', (function (cmd) {
                return function () {
                    ensureTerminalVisible();
                    vlcBringToFront('terminal');
                    focusInput();
                    execute(cmd);
                };
            })(f.cmd));
            explorerBodyEl.appendChild(icon);
        });
        explorerAddressEl.textContent = 'C:\\heel\\users\\' + name + '\\';
        explorerTitleEl.textContent   = name + ' - File Explorer';
        explorerStatusEl.textContent  = files.length + ' objects';
        explorerBackBtn.disabled = false;
    }

    explorerBackBtn.addEventListener('click', function () {
        execute('cd ..');
    });

    document.getElementById('explorer-min-btn').addEventListener('click', function () {
        explorerMinimized = !explorerMinimized;
        explorerWindowEl.classList.toggle('minimized', explorerMinimized);
        if (explorerTaskBtn) explorerTaskBtn.classList.toggle('active', !explorerMinimized);
    });

    document.getElementById('explorer-close-btn').addEventListener('click', function () {
        explorerWindowEl.style.display = 'none';
        if (explorerTaskBtn) { explorerTaskBtn.remove(); explorerTaskBtn = null; }
        var musicDirs = ['music', 'music/segmentation', 'music/unreleased', 'sgmt_demos', 'heel2_demos'];
        var memberDirs = Object.keys(MEMBERS);
        var explorerDirs = ['video', 'photo', 'wallpapers', 'users'].concat(musicDirs).concat(memberDirs);
        if (explorerDirs.indexOf(currentDir) !== -1) {
            currentDir = 'root';
            updatePrompt();
        }
    });

    document.getElementById('explorer-title-bar').addEventListener('mousedown', function (e) {
        vlcBringToFront('explorer');
        explorerDragging = true;
        explorerDragOffX = e.clientX - explorerWindowEl.getBoundingClientRect().left;
        explorerDragOffY = e.clientY - explorerWindowEl.getBoundingClientRect().top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!explorerDragging) return;
        explorerWindowEl.style.left = Math.max(0, Math.min(e.clientX - explorerDragOffX, window.innerWidth  - explorerWindowEl.offsetWidth))  + 'px';
        explorerWindowEl.style.top  = Math.max(0, Math.min(e.clientY - explorerDragOffY, window.innerHeight - explorerWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!explorerDragging) return;
        explorerDragging = false;
        document.body.classList.remove('dragging');
    });

    function explorerRenderPhoto() {
        explorerCurrentView = 'photo';
        explorerBodyEl.innerHTML = '';
        var folderIcon = document.createElement('div');
        folderIcon.className = 'explorer-icon';
        folderIcon.innerHTML = '<div class="folder-icon"></div><span>wallpapers</span>';
        folderIcon.addEventListener('dblclick', function () { execute('cd wallpapers', false, true); });
        explorerBodyEl.appendChild(folderIcon);
        PHOTOS.filter(function (p) { return !p.dir; }).forEach(function (p, i) {
            var idx = PHOTOS.indexOf(p);
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            var dot  = p.file.lastIndexOf('.');
            var base = dot >= 0 ? p.file.slice(0, dot) : p.file;
            var ext  = dot >= 0 ? p.file.slice(dot)    : '';
            icon.innerHTML = '<div class="expl-file-img"></div><span>' + base.replace(/_/g, '_<wbr>') + '<span style="white-space:nowrap">' + ext + '</span></span>';
            icon.addEventListener('dblclick', (function (file, ii) {
                return function () { openPhotoViewer(ii); typeAndExecute('./' + file, false); };
            }(p.file, idx)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = true;
        explorerAddressEl.textContent = 'C:\\heel\\photo\\';
        explorerTitleEl.textContent   = 'photo - File Explorer';
    }

    function explorerRenderWallpapers() {
        explorerCurrentView = 'wallpapers';
        explorerBodyEl.innerHTML = '';
        PHOTOS.filter(function (p) { return p.dir === 'wallpapers'; }).forEach(function (p) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            var dot  = p.file.lastIndexOf('.');
            var base = dot >= 0 ? p.file.slice(0, dot) : p.file;
            var ext  = dot >= 0 ? p.file.slice(dot)    : '';
            icon.innerHTML = '<div class="expl-file-img"></div><span>' + base.replace(/_/g, '_<wbr>') + '<span style="white-space:nowrap">' + ext + '</span></span>';
            icon.addEventListener('dblclick', (function (src) {
                return function () { if (window.innerWidth > 900) setWallpaper(src); };
            }(p.src)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = false;
        explorerAddressEl.textContent = 'C:\\heel\\photo\\wallpapers\\';
        explorerTitleEl.textContent   = 'wallpapers - File Explorer';
    }

    function explorerRenderVideo() {
        explorerCurrentView = 'video';
        explorerBodyEl.innerHTML = '';
        VIDEOS.forEach(function (v) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            icon.innerHTML = '<div class="expl-file-vid"></div><span>' + v.file + '</span>';
            icon.addEventListener('dblclick', (function (file) {
                return function () {
                    execute('./' + file);
                };
            }(v.file)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = true;
        explorerAddressEl.textContent = 'C:\\heel\\video\\';
        explorerTitleEl.textContent   = 'video - File Explorer';
    }

    function explorerRenderMusic() {
        explorerCurrentView = 'music';
        explorerBodyEl.innerHTML = '';
        [{ name: 'segmentation', child: 'segmentation' }, { name: 'unreleased', child: 'unreleased' }].forEach(function (a) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            icon.innerHTML = '<div class="folder-icon"></div><span>' + a.name + '</span>';
            icon.addEventListener('dblclick', (function (child) {
                return function () { execute('cd ' + child, false, true); };
            }(a.child)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = true;
        explorerAddressEl.textContent = 'C:\\heel\\music\\';
        explorerTitleEl.textContent   = 'music - File Explorer';
    }

    function explorerRenderMusicUnreleased() {
        explorerCurrentView = 'music/unreleased';
        explorerBodyEl.innerHTML = '';
        [{ name: 'sgmt_demos', child: 'sgmt_demos' }, { name: 'heel2_demos', child: 'heel2_demos' }].forEach(function (a) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            icon.innerHTML = '<div class="folder-icon"></div><span>' + a.name + '</span>';
            icon.addEventListener('dblclick', (function (child) {
                return function () { execute('cd ' + child, false, true); };
            }(a.child)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = false;
        explorerAddressEl.textContent = 'C:\\heel\\music\\unreleased\\';
        explorerTitleEl.textContent   = 'unreleased - File Explorer';
    }

    function explorerRenderTrackList(key, addressPath, title) {
        explorerCurrentView = key;
        explorerBodyEl.innerHTML = '';
        (TRACKS[key] || []).forEach(function (tr) {
            var icon = document.createElement('div');
            icon.className = 'explorer-icon';
            var fname = tr.file.split('/').pop();
            var dot  = fname.lastIndexOf('.');
            var base = dot >= 0 ? fname.slice(0, dot) : fname;
            var ext  = dot >= 0 ? fname.slice(dot)    : '';
            var baseHtml = base.replace(/_/g, '_<wbr>');
            icon.innerHTML = '<div class="expl-file-aud"></div><span>' + baseHtml + '<span style="white-space:nowrap">' + ext + '</span></span>';
            icon.addEventListener('dblclick', (function (id) {
                return function () { openPlayer(id); execute('play ' + id); };
            }(tr.id)));
            explorerBodyEl.appendChild(icon);
        });
        explorerBackBtn.disabled = false;
        explorerAddressEl.textContent = addressPath;
        explorerTitleEl.textContent   = title + ' - File Explorer';
    }

    function openExplorer(dir) {
        dir = dir || 'users';
        if (explorerWindowEl.style.display !== 'block') {
            explorerWindowEl.style.left = '20px';
            explorerWindowEl.style.top  = '40px';
        }
        explorerWindowEl.style.display = 'block';
        explorerMinimized = false;
        explorerWindowEl.classList.remove('minimized');
        skipToPrompt();
        execute('cd ' + dir, false, true);
        if (!explorerTaskBtn) {
            explorerTaskBtn = document.createElement('button');
            explorerTaskBtn.className = 'task-btn active';
            explorerTaskBtn.textContent = 'explorer.exe';
            explorerTaskBtn.addEventListener('click', function () {
                explorerMinimized = !explorerMinimized;
                explorerWindowEl.classList.toggle('minimized', explorerMinimized);
                explorerTaskBtn.classList.toggle('active', !explorerMinimized);
            });
            document.getElementById('taskbar-tasks').appendChild(explorerTaskBtn);
        }
        vlcBringToFront('explorer');
    }

    /* sync explorer body + chrome with terminal currentDir */
    updateExplorerState = function () {
        if (explorerWindowEl.style.display !== 'block') return;
        if (currentDir === 'video') {
            explorerRenderVideo();
        } else if (currentDir === 'photo') {
            explorerRenderPhoto();
        } else if (currentDir === 'wallpapers') {
            explorerRenderWallpapers();
        } else if (currentDir === 'music') {
            explorerRenderMusic();
        } else if (currentDir === 'music/segmentation') {
            explorerRenderTrackList('segmentation', 'C:\\heel\\music\\segmentation\\', 'segmentation');
        } else if (currentDir === 'music/unreleased') {
            explorerRenderMusicUnreleased();
        } else if (currentDir === 'sgmt_demos') {
            explorerRenderTrackList('sgmt_demos', 'C:\\heel\\music\\unreleased\\sgmt_demos\\', 'sgmt_demos');
        } else if (currentDir === 'heel2_demos') {
            explorerRenderTrackList('heel2_demos', 'C:\\heel\\music\\unreleased\\heel2_demos\\', 'heel2_demos');
        } else if (currentDir === 'users') {
            explorerRenderUsers();
        } else if (MEMBERS[currentDir]) {
            explorerRenderMember(currentDir);
        }
    };

    /* ─── window focus / z-index ──────────────────────────── */
    var zTop = 25;
    function vlcBringToFront(focused) {
        zTop++;
        var map = {
            terminal:  windowEl,
            player:    playerWindowEl,
            vlc:       vlcWindowEl,
            merch:     merchWindowEl,
            explorer:  explorerWindowEl,
            game:      document.getElementById('game-window'),
            mine:      document.getElementById('mine-window'),
            photo:     document.getElementById('photo-window')
        };
        if (map[focused]) map[focused].style.zIndex = zTop;
    }
    windowEl.addEventListener('mousedown',       function () { vlcBringToFront('terminal'); });
    playerWindowEl.addEventListener('mousedown', function () { vlcBringToFront('player'); });
    vlcWindowEl.addEventListener('mousedown',    function () { vlcBringToFront('vlc'); });
    merchWindowEl.addEventListener('mousedown',  function () { vlcBringToFront('merch'); });
    explorerWindowEl.addEventListener('mousedown', function () { vlcBringToFront('explorer'); });
    document.getElementById('game-window').addEventListener('mousedown', function () { vlcBringToFront('game'); });

    function openMerch(query) {
        var normalized = query.replace(/\s+/g, '_');
        var found = null;
        for (var i = 0; i < MERCH.length; i++) {
            var m = MERCH[i];
            if (m.id === normalized || m.id === query || m.label === query || m.label === normalized) {
                found = m; break;
            }
        }
        if (!found) {
            return [{ t: 'blank' }, { t: 'error', v: '\'' + esc(query) + '\': item not found.' }, { t: 'blank' }];
        }
        if (!found.href) {
            return [{ t: 'blank' }, { t: 'text', v: found.id + ': not available for purchase online.', dim: true }, { t: 'blank' }];
        }
        window.open(found.href, '_blank');
        return [{ t: 'blank' }, { t: 'text', v: 'opening checkout for ' + found.id + '...', dim: true }, { t: 'blank' }];
    }

    function playTrack(query) {
        var allTracks = TRACKS.segmentation.concat(TRACKS.sgmt_demos).concat(TRACKS.heel2_demos);
        var q         = query.toLowerCase().trim();
        var qUnder    = q.replace(/\s+/g, '_');
        var found = null;
        for (var i = 0; i < allTracks.length; i++) {
            var t         = allTracks[i];
            var idUnder   = t.id.replace(/\s+/g, '_');
            var labelFull = t.label.toLowerCase();
            // strip leading "NN - " track number prefix for bare-name matching
            var labelBare = labelFull.replace(/^\d+\s*-\s*/, '');
            if (idUnder === qUnder || labelFull === q || labelBare === q || labelBare.replace(/\s+/g, '_') === qUnder) {
                found = t;
                break;
            }
        }
        if (!found) {
            return [{ t: 'blank' }, { t: 'error', v: '\'' + esc(query) + '\' not found.' }, { t: 'blank' }];
        }
        if (currentAudio) { currentAudio.pause(); }
        currentAudio = new Audio(found.file);
        currentAudio.volume = masterVolume;
        currentAudio.muted  = masterMuted;
        audioPaused  = false;
        currentTrackLabel = found.label;
        currentAudio.play().catch(function () {});
        updateNowPlaying(found.label);
        currentAudio.addEventListener('ended', function () {
            currentAudio = null;
            audioPaused  = false;
            currentTrackLabel = null;
            updateNowPlaying(null);
        });
        return [{ t: 'blank' }, { t: 'text', v: 'now playing: ' + found.label }, { t: 'blank' }];
    }

    function typeAndExecute(cmd, absolute) {
        if (animating) return;
        input.value = '';
        focusInput();
        var i = 0;
        var iv = setInterval(function () {
            if (i < cmd.length) {
                input.value += cmd[i];
                i++;
            } else {
                clearInterval(iv);
                setTimeout(function () {
                    var val = input.value;
                    cmdHistory.unshift(val);
                    historyPos = -1;
                    input.value = '';
                    execute(val, false, absolute);
                }, 500);
            }
        }, 40);
    }

    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function scrollBottom() {
        terminal.scrollTop = terminal.scrollHeight;
    }

/* ─── game window (shared container for all games) ───── */
    var gameWindowEl  = document.getElementById('game-window');
    var gameCanvas    = document.getElementById('game-canvas');
    var gameTitleEl   = document.getElementById('game-title-text');
    var gameOpen      = false;
    var gameTaskBtn   = null;
    var activeGame    = null;
    var stopActiveGame = function () {};

    function openGameWindow(title) {
        if (!gameOpen) {
            gameWindowEl.style.left = '20px';
            gameWindowEl.style.top  = Math.max(20, Math.floor((window.innerHeight - 412) / 2)) + 'px';
            gameWindowEl.style.display = 'block';
            gameOpen = true;
            gameTaskBtn = document.createElement('button');
            gameTaskBtn.className = 'task-btn active';
            gameTaskBtn.addEventListener('click', function () {
                var min = gameWindowEl.classList.contains('minimized');
                gameWindowEl.classList.toggle('minimized', !min);
                gameTaskBtn.classList.toggle('active', min);
            });
            document.getElementById('taskbar-tasks').appendChild(gameTaskBtn);
        } else {
            stopActiveGame();
            if (gameWindowEl.classList.contains('minimized')) {
                gameWindowEl.classList.remove('minimized');
                gameTaskBtn.classList.add('active');
            }
        }
        gameTitleEl.textContent = title;
        gameTaskBtn.textContent = title;
        vlcBringToFront('game');
    }

/* ─── breakout game ──────────────────────────────────── */
    var bkCanvas = gameCanvas;
    var bkCtx    = bkCanvas ? bkCanvas.getContext('2d') : null;
    var bkScoreEl = document.getElementById('bk-score');
    var bkLivesEl = document.getElementById('bk-lives');

    var BK = {
        W: 480, H: 360,
        COLS: 8, ROWS: 5,
        BRICK_W: 54, BRICK_H: 16, BRICK_GAP: 4,
        BOFF_X: 10, BOFF_Y: 36,
        PAD_W: 80, PAD_H: 10, PAD_Y: 330,
        BALL_R: 7,
        COLORS: ['#ff4444', '#ff8800', '#ffcc00', '#33ff33', '#33ccff']
    };

    var bkState   = 'idle';
    var bkBricks  = [];
    var bkPadX    = 200;
    var bkBallX   = 240, bkBallY = 280;
    var bkDX      = 3,   bkDY    = -4;
    var bkScore   = 0,   bkLives = 3;
    var bkKeys     = { left: false, right: false };
    var bkRafId    = null;
    var bkLastTime = 0;

    function bkInitBricks() {
        bkBricks = [];
        for (var r = 0; r < BK.ROWS; r++) {
            for (var c = 0; c < BK.COLS; c++) {
                bkBricks.push({
                    x: BK.BOFF_X + c * (BK.BRICK_W + BK.BRICK_GAP),
                    y: BK.BOFF_Y + r * (BK.BRICK_H + BK.BRICK_GAP),
                    w: BK.BRICK_W, h: BK.BRICK_H,
                    color: BK.COLORS[r], alive: true
                });
            }
        }
    }

    function bkReset() {
        bkPadX  = (BK.W - BK.PAD_W) / 2;
        bkBallX = BK.W / 2;
        bkBallY = BK.PAD_Y - 20;
        bkDX    = (Math.random() < 0.5 ? 1 : -1) * 3;
        bkDY    = -4;
    }

    function bkNewGame() {
        bkScore = 0; bkLives = 3;
        bkInitBricks();
        bkReset();
        bkState = 'idle';
        bkUpdateHud();
        bkDraw();
    }

    function bkUpdateHud() {
        if (bkScoreEl) bkScoreEl.textContent = bkScore;
        if (bkLivesEl) bkLivesEl.textContent = bkLives;
    }

    function bkDraw() {
        if (!bkCtx) return;
        var ctx = bkCtx;
        ctx.clearRect(0, 0, BK.W, BK.H);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, BK.W, BK.H);

        // bricks
        for (var i = 0; i < bkBricks.length; i++) {
            var b = bkBricks[i];
            if (!b.alive) continue;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(b.x, b.y, b.w, 3);
        }

        // paddle
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(bkPadX, BK.PAD_Y, BK.PAD_W, BK.PAD_H);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bkPadX, BK.PAD_Y, BK.PAD_W, 2);
        ctx.fillStyle = '#808080';
        ctx.fillRect(bkPadX, BK.PAD_Y + BK.PAD_H - 2, BK.PAD_W, 2);

        // ball
        if (bkState !== 'idle') {
            ctx.beginPath();
            ctx.arc(bkBallX, bkBallY, BK.BALL_R, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        // overlays
        ctx.textAlign = 'center';
        if (bkState === 'idle') {
            ctx.fillStyle = '#33ff33';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('PRESS SPACE TO PLAY', BK.W / 2, BK.H / 2 + 10);
            ctx.font = '11px monospace';
            ctx.fillText('ARROW KEYS OR MOUSE TO MOVE', BK.W / 2, BK.H / 2 + 30);
        } else if (bkState === 'gameover') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, BK.H / 2 - 30, BK.W, 70);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 20px monospace';
            ctx.fillText('GAME OVER', BK.W / 2, BK.H / 2 + 5);
            ctx.fillStyle = '#33ff33';
            ctx.font = '12px monospace';
            ctx.fillText('SPACE TO RESTART', BK.W / 2, BK.H / 2 + 26);
        } else if (bkState === 'win') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, BK.H / 2 - 30, BK.W, 70);
            ctx.fillStyle = '#33ff33';
            ctx.font = 'bold 20px monospace';
            ctx.fillText('YOU WIN!', BK.W / 2, BK.H / 2 + 5);
            ctx.font = '12px monospace';
            ctx.fillText('SPACE TO PLAY AGAIN', BK.W / 2, BK.H / 2 + 26);
        }
    }

    function bkTick(timestamp) {
        if (bkState !== 'playing') return;

        var dt = bkLastTime ? Math.min((timestamp - bkLastTime) / (1000 / 60), 3) : 1;
        bkLastTime = timestamp;

        var PAD_SPEED = 6 * dt;
        if (bkKeys.left)  bkPadX = Math.max(0, bkPadX - PAD_SPEED);
        if (bkKeys.right) bkPadX = Math.min(BK.W - BK.PAD_W, bkPadX + PAD_SPEED);

        bkBallX += bkDX * dt;
        bkBallY += bkDY * dt;

        // wall collisions
        if (bkBallX - BK.BALL_R <= 0)       { bkBallX = BK.BALL_R;           bkDX =  Math.abs(bkDX); }
        if (bkBallX + BK.BALL_R >= BK.W)    { bkBallX = BK.W - BK.BALL_R;   bkDX = -Math.abs(bkDX); }
        if (bkBallY - BK.BALL_R <= 0)        { bkBallY = BK.BALL_R;           bkDY =  Math.abs(bkDY); }

        // ball lost
        if (bkBallY - BK.BALL_R > BK.H) {
            bkLives--;
            bkUpdateHud();
            if (bkLives <= 0) {
                bkState = 'gameover';
            } else {
                bkReset();
                bkState = 'idle';
            }
            bkDraw();
            return;
        }

        // paddle collision
        if (bkBallY + BK.BALL_R >= BK.PAD_Y &&
            bkBallY + BK.BALL_R <= BK.PAD_Y + BK.PAD_H + Math.abs(bkDY) + 1 &&
            bkDY > 0 &&
            bkBallX >= bkPadX - BK.BALL_R && bkBallX <= bkPadX + BK.PAD_W + BK.BALL_R) {
            bkDY = -Math.abs(bkDY);
            var hit = (bkBallX - bkPadX) / BK.PAD_W;
            bkDX = (hit - 0.5) * 8;
            if (Math.abs(bkDX) < 1) bkDX = bkDX < 0 ? -1 : 1;
            bkBallY = BK.PAD_Y - BK.BALL_R;
        }

        // brick collisions
        for (var i = 0; i < bkBricks.length; i++) {
            var b = bkBricks[i];
            if (!b.alive) continue;
            if (bkBallX + BK.BALL_R > b.x && bkBallX - BK.BALL_R < b.x + b.w &&
                bkBallY + BK.BALL_R > b.y && bkBallY - BK.BALL_R < b.y + b.h) {
                b.alive = false;
                bkScore += 10;
                bkUpdateHud();
                var ol = (bkBallX + BK.BALL_R) - b.x;
                var or2 = (b.x + b.w) - (bkBallX - BK.BALL_R);
                var ot = (bkBallY + BK.BALL_R) - b.y;
                var ob = (b.y + b.h) - (bkBallY - BK.BALL_R);
                if (Math.min(ol, or2) < Math.min(ot, ob)) { bkDX = -bkDX; } else { bkDY = -bkDY; }
                break;
            }
        }

        // check win
        var allDead = true;
        for (var j = 0; j < bkBricks.length; j++) { if (bkBricks[j].alive) { allDead = false; break; } }
        if (allDead) { bkState = 'win'; bkDraw(); return; }

        bkDraw();
        bkRafId = requestAnimationFrame(bkTick);
    }

    function bkStart() {
        if (bkRafId) cancelAnimationFrame(bkRafId);
        bkLastTime = 0;
        bkState = 'playing';
        bkRafId = requestAnimationFrame(bkTick);
    }

    function openBreakout() {
        openGameWindow('BREAKOUT.EXE');
        if (activeGame !== 'breakout') {
            activeGame = 'breakout';
            stopActiveGame = function () {
                if (bkRafId) { cancelAnimationFrame(bkRafId); bkRafId = null; }
                bkState = 'idle';
            };
            bkNewGame();
        }
    }

    // keyboard controls
    document.addEventListener('keydown', function (e) {
        if (!gameOpen || gameWindowEl.classList.contains('minimized')) return;
        if (e.key === 'ArrowLeft')  { bkKeys.left  = true; if (bkState === 'playing') e.preventDefault(); }
        if (e.key === 'ArrowRight') { bkKeys.right = true; if (bkState === 'playing') e.preventDefault(); }
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (bkState === 'idle' || bkState === 'gameover' || bkState === 'win') {
                if (bkState !== 'idle') { bkInitBricks(); bkReset(); bkScore = 0; bkUpdateHud(); }
                bkStart();
                e.preventDefault();
            }
        }
    });
    document.addEventListener('keyup', function (e) {
        if (e.key === 'ArrowLeft')  bkKeys.left  = false;
        if (e.key === 'ArrowRight') bkKeys.right = false;
    });

    // mouse control
    if (bkCanvas) {
        bkCanvas.addEventListener('mousemove', function (e) {
            if (bkState !== 'playing') return;
            var rect = bkCanvas.getBoundingClientRect();
            var scaleX = BK.W / rect.width;
            var mx = (e.clientX - rect.left) * scaleX;
            bkPadX = Math.max(0, Math.min(BK.W - BK.PAD_W, mx - BK.PAD_W / 2));
        });
        bkCanvas.addEventListener('click', function () {
            if (bkState === 'idle' || bkState === 'gameover' || bkState === 'win') {
                if (bkState !== 'idle') { bkInitBricks(); bkReset(); bkScore = 0; bkUpdateHud(); }
                bkStart();
            }
        });
    }

    // breakout window buttons
    document.getElementById('game-min-btn').addEventListener('click', function () {
        var min = gameWindowEl.classList.contains('minimized');
        gameWindowEl.classList.toggle('minimized', !min);
        if (gameTaskBtn) gameTaskBtn.classList.toggle('active', min);
    });
    document.getElementById('game-close-btn').addEventListener('click', function () {
        stopActiveGame();
        activeGame = null;
        gameOpen = false;
        gameWindowEl.style.display = 'none';
        if (gameTaskBtn) { gameTaskBtn.parentNode.removeChild(gameTaskBtn); gameTaskBtn = null; }
    });

    // breakout window dragging
    var bkDragging = false, bkDragOffX = 0, bkDragOffY = 0;
    document.getElementById('game-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        vlcBringToFront('game');
        bkDragging = true;
        gameWindowEl.style.transform = '';
        var r = gameWindowEl.getBoundingClientRect();
        bkDragOffX = e.clientX - r.left;
        bkDragOffY = e.clientY - r.top;
        document.body.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!bkDragging) return;
        gameWindowEl.style.left = Math.max(0, Math.min(e.clientX - bkDragOffX, window.innerWidth  - gameWindowEl.offsetWidth))  + 'px';
        gameWindowEl.style.top  = Math.max(0, Math.min(e.clientY - bkDragOffY, window.innerHeight - gameWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!bkDragging) return;
        bkDragging = false;
        document.body.classList.remove('dragging');
    });

/* ─── photo viewer ───────────────────────────────────── */
    var photoWindowEl   = document.getElementById('photo-window');
    var photoImgEl      = document.getElementById('photo-img');
    var photoEmptyEl    = document.getElementById('photo-empty');
    var photoDisplayEl  = document.getElementById('photo-display');
    var photoCounterEl  = document.getElementById('photo-counter');
    var photoTitleEl    = document.getElementById('photo-title-text');
    var photoPrevBtn    = document.getElementById('photo-prev');
    var photoNextBtn    = document.getElementById('photo-next');
    var photoDownloadEl = document.getElementById('photo-download');
    var photoOpen      = false;
    var photoTaskBtn   = null;
    var photoIndex     = 0;
    var photoSet       = [];

    function photoResize() {
        var natW = photoImgEl.naturalWidth;
        var natH = photoImgEl.naturalHeight;
        if (!natW || !natH) return;
        var maxW = 460;
        var maxH = Math.min(620, Math.floor(window.innerHeight * 0.75));
        var scale = Math.min(1, maxW / natW, maxH / natH);
        var dispW = Math.max(240, Math.round(natW * scale));
        var dispH = Math.max(160, Math.round(natH * scale));
        photoDisplayEl.style.width  = dispW + 'px';
        photoDisplayEl.style.height = dispH + 'px';
        photoWindowEl.style.width   = (dispW + 12) + 'px';
    }

    function photoShow(index) {
        if (photoSet.length === 0) {
            photoImgEl.style.display  = 'none';
            photoEmptyEl.style.display = '';
            photoCounterEl.textContent = '\u2014 / \u2014';
            photoTitleEl.textContent   = 'Photo Viewer';
            photoPrevBtn.disabled = true;
            photoNextBtn.disabled = true;
            return;
        }
        photoIndex = Math.max(0, Math.min(index, photoSet.length - 1));
        var p = photoSet[photoIndex];
        photoImgEl.onload = photoResize;
        photoImgEl.src             = p.src;
        photoImgEl.style.display   = 'block';
        photoEmptyEl.style.display = 'none';
        photoCounterEl.textContent = (photoIndex + 1) + ' / ' + photoSet.length;
        photoTitleEl.textContent   = p.file + ' - Photo Viewer';
        photoPrevBtn.disabled = photoIndex === 0;
        photoNextBtn.disabled = photoIndex === photoSet.length - 1;
        if (photoDownloadEl) {
            photoDownloadEl.href = p.src;
        }
        if (photoImgEl.complete && photoImgEl.naturalWidth) photoResize();
    }

    function openPhotoViewer(globalIndex) {
        var p = PHOTOS[globalIndex];
        var dirKey = p && p.dir ? p.dir : null;
        photoSet = PHOTOS.filter(function (x) { return (x.dir || null) === dirKey; });
        var index = photoSet.indexOf(p);
        if (!photoOpen) {
            photoWindowEl.style.left = '60px';
            photoWindowEl.style.top  = Math.max(20, Math.floor((window.innerHeight - 400) / 2)) + 'px';
            photoWindowEl.style.display = 'block';
            photoOpen = true;
            photoTaskBtn = document.createElement('button');
            photoTaskBtn.className   = 'task-btn active';
            photoTaskBtn.textContent = 'kodak.exe';
            photoTaskBtn.addEventListener('click', function () {
                var min = photoWindowEl.classList.contains('minimized');
                photoWindowEl.classList.toggle('minimized', !min);
                photoTaskBtn.classList.toggle('active', min);
            });
            document.getElementById('taskbar-tasks').appendChild(photoTaskBtn);
        } else {
            if (photoWindowEl.classList.contains('minimized')) {
                photoWindowEl.classList.remove('minimized');
                photoTaskBtn.classList.add('active');
            }
        }
        photoShow(index < 0 ? 0 : index);
        vlcBringToFront('photo');
    }

    function openPhotoViewerWithSet(set, startIndex) {
        photoSet = set;
        if (!photoOpen) {
            photoWindowEl.style.left = '60px';
            photoWindowEl.style.top  = Math.max(20, Math.floor((window.innerHeight - 400) / 2)) + 'px';
            photoWindowEl.style.display = 'block';
            photoOpen = true;
            photoTaskBtn = document.createElement('button');
            photoTaskBtn.className   = 'task-btn active';
            photoTaskBtn.textContent = 'kodak.exe';
            photoTaskBtn.addEventListener('click', function () {
                var min = photoWindowEl.classList.contains('minimized');
                photoWindowEl.classList.toggle('minimized', !min);
                photoTaskBtn.classList.toggle('active', min);
            });
            document.getElementById('taskbar-tasks').appendChild(photoTaskBtn);
        } else {
            if (photoWindowEl.classList.contains('minimized')) {
                photoWindowEl.classList.remove('minimized');
                photoTaskBtn.classList.add('active');
            }
        }
        photoShow(startIndex || 0);
        vlcBringToFront('photo');
    }

    function openPhotoViewerWithImage(src, name) {
        openPhotoViewerWithSet([{ src: src, file: name }], 0);
    }

    photoPrevBtn.addEventListener('click', function () { photoShow(photoIndex - 1); });
    photoNextBtn.addEventListener('click', function () { photoShow(photoIndex + 1); });
    photoWindowEl.addEventListener('mousedown', function () { vlcBringToFront('photo'); });

    document.addEventListener('keydown', function (e) {
        if (!photoOpen || photoWindowEl.classList.contains('minimized')) return;
        if (e.key === 'ArrowLeft')  { photoShow(photoIndex - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { photoShow(photoIndex + 1); e.preventDefault(); }
    });

    document.getElementById('photo-min-btn').addEventListener('click', function () {
        var min = photoWindowEl.classList.contains('minimized');
        photoWindowEl.classList.toggle('minimized', !min);
        if (photoTaskBtn) photoTaskBtn.classList.toggle('active', min);
    });

    document.getElementById('photo-close-btn').addEventListener('click', function () {
        photoOpen = false;
        photoWindowEl.style.display = 'none';
        if (photoTaskBtn) { photoTaskBtn.parentNode.removeChild(photoTaskBtn); photoTaskBtn = null; }
    });

    var photoDragging = false, photoDragOffX = 0, photoDragOffY = 0;
    document.getElementById('photo-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        vlcBringToFront('photo');
        photoDragging = true;
        photoWindowEl.style.transform = '';
        var rect = photoWindowEl.getBoundingClientRect();
        photoDragOffX = e.clientX - rect.left;
        photoDragOffY = e.clientY - rect.top;
        document.body.classList.add('dragging');
    });
    document.addEventListener('mousemove', function (e) {
        if (!photoDragging) return;
        photoWindowEl.style.left = Math.max(0, Math.min(e.clientX - photoDragOffX, window.innerWidth  - photoWindowEl.offsetWidth))  + 'px';
        photoWindowEl.style.top  = Math.max(0, Math.min(e.clientY - photoDragOffY, window.innerHeight - photoWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!photoDragging) return;
        photoDragging = false;
        document.body.classList.remove('dragging');
    });
    photoWindowEl.addEventListener('mousedown', function () { vlcBringToFront('photo'); });

/* ─── minesweeper game ───────────────────────────────── */
    var mineWindowEl  = document.getElementById('mine-window');
    var mineGridEl    = document.getElementById('mine-grid');
    var mineCountLcd  = document.getElementById('mine-count-lcd');
    var mineTimeLcd   = document.getElementById('mine-time-lcd');
    var mineSmileBtn  = document.getElementById('mine-smile');
    var mineOpen      = false;
    var mineTaskBtn   = null;

    var MS_ROWS  = 9;
    var MS_COLS  = 9;
    var MS_MINES = 10;

    var msGrid       = [];
    var msState      = 'idle';
    var msTimer      = 0;
    var msTimerIv    = null;
    var msFlagsLeft  = MS_MINES;
    var msFirstClick = true;

    var MS_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080'];

    function msCell(r, c) { return msGrid[r * MS_COLS + c]; }

    function msInit() {
        msGrid = [];
        for (var i = 0; i < MS_ROWS * MS_COLS; i++) {
            msGrid.push({ mine: false, count: 0, revealed: false, flagged: false });
        }
        msState = 'idle';
        msTimer = 0;
        msFlagsLeft = MS_MINES;
        msFirstClick = true;
        if (msTimerIv) { clearInterval(msTimerIv); msTimerIv = null; }
        msBuildDom();
        msUpdateLcds();
        mineSmileBtn.textContent = '\u263A';
    }

    function msPlaceMines(safeR, safeC) {
        var placed = 0;
        while (placed < MS_MINES) {
            var r = Math.floor(Math.random() * MS_ROWS);
            var c = Math.floor(Math.random() * MS_COLS);
            if (msCell(r, c).mine) continue;
            if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
            msCell(r, c).mine = true;
            placed++;
        }
        for (var row = 0; row < MS_ROWS; row++) {
            for (var col = 0; col < MS_COLS; col++) {
                if (msCell(row, col).mine) continue;
                var n = 0;
                for (var dr = -1; dr <= 1; dr++) {
                    for (var dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        var nr = row + dr, nc = col + dc;
                        if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS && msCell(nr, nc).mine) n++;
                    }
                }
                msCell(row, col).count = n;
            }
        }
    }

    function msReveal(r, c) {
        var cell = msCell(r, c);
        if (cell.revealed || cell.flagged) return;
        cell.revealed = true;
        if (cell.count === 0 && !cell.mine) {
            for (var dr = -1; dr <= 1; dr++) {
                for (var dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    var nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS) msReveal(nr, nc);
                }
            }
        }
    }

    function msBuildDom() {
        mineGridEl.innerHTML = '';
        for (var r = 0; r < MS_ROWS; r++) {
            for (var c = 0; c < MS_COLS; c++) {
                var el = document.createElement('div');
                el.className = 'mine-cell';
                el.dataset.r = r;
                el.dataset.c = c;
                mineGridEl.appendChild(el);
            }
        }
    }

    function msRenderCell(r, c) {
        var cell = msCell(r, c);
        var el   = mineGridEl.children[r * MS_COLS + c];
        if (!el) return;
        el.className    = 'mine-cell';
        el.textContent  = '';
        el.style.color  = '';
        if (cell.revealed) {
            el.classList.add('revealed');
            if (cell.mine) {
                el.textContent = '\u25CF';
                el.classList.add('mine-explode');
            } else if (cell.count > 0) {
                el.textContent = cell.count;
                el.style.color = MS_COLORS[cell.count];
            }
        } else if (cell.flagged) {
            el.textContent = '\u2691';
            el.style.color = '#ff0000';
        }
    }

    function msRenderAll() {
        for (var r = 0; r < MS_ROWS; r++) {
            for (var c = 0; c < MS_COLS; c++) msRenderCell(r, c);
        }
    }

    function msUpdateLcds() {
        mineCountLcd.textContent = String(Math.max(0, Math.min(999, msFlagsLeft))).padStart(3, '0');
        mineTimeLcd.textContent  = String(Math.min(999, msTimer)).padStart(3, '0');
    }

    function msCheckWin() {
        for (var i = 0; i < msGrid.length; i++) {
            if (!msGrid[i].mine && !msGrid[i].revealed) return false;
        }
        return true;
    }

    function msRevealAllMines() {
        for (var i = 0; i < msGrid.length; i++) {
            if (msGrid[i].mine && !msGrid[i].flagged) msGrid[i].revealed = true;
        }
        msRenderAll();
    }

    function msHandleClick(r, c) {
        if (msState === 'dead' || msState === 'win') return;
        var cell = msCell(r, c);
        if (cell.flagged || cell.revealed) return;
        if (msFirstClick) {
            msFirstClick = false;
            msPlaceMines(r, c);
            msState = 'playing';
            msTimerIv = setInterval(function () {
                if (msState !== 'playing') { clearInterval(msTimerIv); msTimerIv = null; return; }
                msTimer = Math.min(999, msTimer + 1);
                msUpdateLcds();
            }, 1000);
        }
        if (cell.mine) {
            cell.revealed = true;
            msState = 'dead';
            if (msTimerIv) { clearInterval(msTimerIv); msTimerIv = null; }
            mineSmileBtn.textContent = '\u2639';
            msRevealAllMines();
        } else {
            msReveal(r, c);
            msRenderAll();
            if (msCheckWin()) {
                msState = 'win';
                if (msTimerIv) { clearInterval(msTimerIv); msTimerIv = null; }
                mineSmileBtn.textContent = '\u263B';
                for (var i = 0; i < msGrid.length; i++) {
                    if (msGrid[i].mine) msGrid[i].flagged = true;
                }
                msFlagsLeft = 0;
            }
            msUpdateLcds();
        }
    }

    function msHandleRightClick(r, c) {
        if (msState === 'dead' || msState === 'win' || msFirstClick) return;
        var cell = msCell(r, c);
        if (cell.revealed) return;
        cell.flagged = !cell.flagged;
        msFlagsLeft += cell.flagged ? -1 : 1;
        msRenderCell(r, c);
        msUpdateLcds();
    }

    mineGridEl.addEventListener('click', function (e) {
        var el = e.target.closest('.mine-cell');
        if (!el) return;
        msHandleClick(+el.dataset.r, +el.dataset.c);
    });

    mineGridEl.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var el = e.target.closest('.mine-cell');
        if (!el) return;
        msHandleRightClick(+el.dataset.r, +el.dataset.c);
    });

    mineSmileBtn.addEventListener('click', function () { msInit(); });

    function openMinesweeper() {
        if (!mineOpen) {
            mineWindowEl.style.left = '80px';
            mineWindowEl.style.top  = Math.max(20, Math.floor((window.innerHeight - 320) / 2)) + 'px';
            mineWindowEl.style.display = 'block';
            mineOpen = true;
            mineTaskBtn = document.createElement('button');
            mineTaskBtn.className   = 'task-btn active';
            mineTaskBtn.textContent = 'Minesweeper';
            mineTaskBtn.addEventListener('click', function () {
                var min = mineWindowEl.classList.contains('minimized');
                mineWindowEl.classList.toggle('minimized', !min);
                mineTaskBtn.classList.toggle('active', min);
            });
            document.getElementById('taskbar-tasks').appendChild(mineTaskBtn);
            msInit();
        } else {
            if (mineWindowEl.classList.contains('minimized')) {
                mineWindowEl.classList.remove('minimized');
                mineTaskBtn.classList.add('active');
            }
        }
        vlcBringToFront('mine');
    }

    document.getElementById('mine-min-btn').addEventListener('click', function () {
        var min = mineWindowEl.classList.contains('minimized');
        mineWindowEl.classList.toggle('minimized', !min);
        if (mineTaskBtn) mineTaskBtn.classList.toggle('active', min);
    });

    document.getElementById('mine-close-btn').addEventListener('click', function () {
        if (msTimerIv) { clearInterval(msTimerIv); msTimerIv = null; }
        mineOpen = false;
        mineWindowEl.style.display = 'none';
        if (mineTaskBtn) { mineTaskBtn.parentNode.removeChild(mineTaskBtn); mineTaskBtn = null; }
    });

    var mineDragging = false, mineDragOffX = 0, mineDragOffY = 0;
    document.getElementById('mine-title-bar').addEventListener('mousedown', function (e) {
        if (e.target.classList.contains('wbtn')) return;
        vlcBringToFront('mine');
        mineDragging = true;
        mineWindowEl.style.transform = '';
        var rect = mineWindowEl.getBoundingClientRect();
        mineDragOffX = e.clientX - rect.left;
        mineDragOffY = e.clientY - rect.top;
        document.body.classList.add('dragging');
    });
    document.addEventListener('mousemove', function (e) {
        if (!mineDragging) return;
        mineWindowEl.style.left = Math.max(0, Math.min(e.clientX - mineDragOffX, window.innerWidth  - mineWindowEl.offsetWidth))  + 'px';
        mineWindowEl.style.top  = Math.max(0, Math.min(e.clientY - mineDragOffY, window.innerHeight - mineWindowEl.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (!mineDragging) return;
        mineDragging = false;
        document.body.classList.remove('dragging');
    });
    mineWindowEl.addEventListener('mousedown', function () { vlcBringToFront('mine'); });

/* ─── taskbar ─────────────────────────────────────────── */
    function ensureTerminalVisible() {
        if (windowEl.style.display === 'none') {
            windowEl.style.display = '';
        }
        setMinimized(false);
    }

    function setMinimized(val) {
        if (val && document.body.classList.contains('maximized')) {
            document.body.classList.remove('maximized');
            document.getElementById('max-btn').innerHTML = '&#9633;';
        }
        windowEl.classList.toggle('minimized', val);
        document.getElementById('task-heel').classList.toggle('active', !val);
    }
    function toggleMinimize() {
        setMinimized(!windowEl.classList.contains('minimized'));
    }

    // Clock
    function updateClock() {
        var now  = new Date();
        var h    = now.getHours();
        var m    = now.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        document.getElementById('taskbar-clock').textContent =
            h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }
    updateClock();
    setInterval(updateClock, 30000);

    /* ── preload photo images after boot ── */
    setTimeout(function () {
        var srcs = [];
        PHOTOS.forEach(function (p) { if (p.src) srcs.push(p.src); });
        MERCH.forEach(function (m) {
            if (m.photo) srcs.push(m.photo);
            if (m.samples) m.samples.forEach(function (s) { srcs.push(s); });
        });
        srcs.push('images/album_front_cover.png', 'images/album_back_cover.png');
        srcs.forEach(function (src) { var i = new Image(); i.src = src; });
    }, 4000);


    /* ── tray volume popup ── */
    (function () {
        var btn      = document.getElementById('tray-vol-btn');
        var popup    = document.getElementById('vol-popup');
        var slider   = document.getElementById('vol-slider');
        var pct      = document.getElementById('vol-pct');
        var icon     = document.getElementById('tray-vol-icon');

        var SVG_ON   = '<polygon points="1,5 5,5 8,2 8,12 5,9 1,9" fill="currentColor"/><path d="M9.5 4.5 Q12 7 9.5 9.5" stroke="currentColor" fill="none" stroke-width="1.3" stroke-linecap="round"/>';
        var SVG_MUTE = '<polygon points="1,5 5,5 8,2 8,12 5,9 1,9" fill="currentColor"/><line x1="10" y1="4.5" x2="13" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="13" y1="4.5" x2="10" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';

        function updateIcon() {
            icon.innerHTML = (masterMuted || masterVolume === 0) ? SVG_MUTE : SVG_ON;
        }

        function openPopup() {
            var r = btn.getBoundingClientRect();
            var popupW = 46;
            var left = r.left + r.width / 2 - popupW / 2;
            left = Math.max(4, Math.min(left, window.innerWidth - popupW - 4));
            popup.style.left = left + 'px';
            popup.style.display = 'block';
            btn.classList.add('active');
        }
        function closePopup() {
            popup.style.display = 'none';
            btn.classList.remove('active');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (popup.style.display === 'block') { closePopup(); return; }
            openPopup();
        });
        btn.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            masterMuted = !masterMuted;
            if (currentAudio) currentAudio.muted = masterMuted;
            updateIcon();
        });
        slider.addEventListener('input', function () {
            masterVolume = this.value / 100;
            masterMuted  = masterVolume === 0;
            pct.textContent = this.value + '%';
            if (currentAudio) {
                currentAudio.volume = masterVolume;
                currentAudio.muted  = masterMuted;
            }
            updateIcon();
        });
        document.addEventListener('click', function (e) {
            if (popup.style.display === 'block' && !popup.contains(e.target) && e.target !== btn) {
                closePopup();
            }
        });
    }());

    /* ── tray RSS popup ── */
    (function () {
        var btn   = document.getElementById('tray-rss-btn');
        var popup = document.getElementById('rss-popup');
        var closeBtn = document.getElementById('rss-popup-close');

        function openPopup() {
            var r = btn.getBoundingClientRect();
            var popupW = 180;
            var left = r.left + r.width / 2 - popupW / 2;
            left = Math.max(4, Math.min(left, window.innerWidth - popupW - 4));
            popup.style.left = left + 'px';
            popup.style.display = 'block';
            btn.classList.add('active');
        }
        function closePopup() {
            popup.style.display = 'none';
            btn.classList.remove('active');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (popup.style.display === 'block') { closePopup(); } else { openPopup(); }
        });
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closePopup();
        });
        document.addEventListener('click', function (e) {
            if (popup.style.display === 'block' && !popup.contains(e.target)) {
                closePopup();
            }
        });
    }());

    // Task button
    document.getElementById('task-heel').addEventListener('click', function () {
        if (document.body.classList.contains('mobile-home')) {
            exitMobileHome();
            return;
        }
        if (windowEl.style.display === 'none') {
            windowEl.style.display = '';
            setMinimized(false);
        } else {
            toggleMinimize();
        }
    });

    // Start menu
    var startMenu = document.getElementById('start-menu');
    var startBtn  = document.getElementById('start-btn');

    startBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = startMenu.classList.toggle('open');
        startBtn.classList.toggle('open', open);
    });

    document.addEventListener('click', function () {
        startMenu.classList.remove('open');
        startBtn.classList.remove('open');
    });

    startMenu.addEventListener('click', function (e) { e.stopPropagation(); });

    startMenu.querySelectorAll('.start-item').forEach(function (item) {
        item.addEventListener('click', function () {
            var cmd = this.dataset.cmd;
            startMenu.classList.remove('open');
            startBtn.classList.remove('open');
            if (cmd === 'shutdown') { triggerJumpscare(); return; }
            ensureTerminalVisible();
            skipToPrompt();
            execute(cmd);
            focusInput();
        });
    });

}());
