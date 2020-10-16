// For index.html
function updateTheme() {
    const body = document.body;
    if (localStorage.getItem('theme') === 'light') {
        document.querySelector('#themeBtn .mdc-fab__label').innerHTML = "View in dark theme";
        document.querySelector('#themeBtn .mdc-fab__icon').innerHTML = 'brightness_2';
        if (!body.classList.contains('light')) body.classList.add('light');
    }
    else {
        document.querySelector('#themeBtn .mdc-fab__label').innerHTML = "View in light theme";
        document.querySelector('#themeBtn .mdc-fab__icon').innerHTML = 'brightness_7';
        if (body.classList.contains('light')) body.classList.remove('light');
    }
}

updateTheme();