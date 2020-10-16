let zeruiInterval;
function zeruiThemeToggle() {
    if (localStorage.getItem('zerui') === 'on') {
        zeruiInterval = setInterval(function() {
            toggleTheme();
        }, 10);
    }
    else {
        clearInterval(zeruiInterval);
    }
}
function changeZeruiMode() {
    if (localStorage.getItem('zerui') === 'on') {
        localStorage.setItem('zerui', 'off');
        zeruiThemeToggle();
    }
    else {
        localStorage.setItem('zerui', 'on');
        zeruiThemeToggle();
    }
}
zeruiThemeToggle();

// Theme toggle
if (localStorage.getItem('theme') === null) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const newColorScheme = e.matches;
        localStorage.setItem("theme", newColorScheme ? "dark" : "light");
        updateTheme();
    });
}

function toggleTheme() {
    if (localStorage.getItem('theme') === 'light') {
        localStorage.setItem('theme', 'dark');
        updateTheme();
    } else {
        localStorage.setItem('theme', 'light');
        updateTheme();
    }
}

updateTheme();