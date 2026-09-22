const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');

const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu?.classList.toggle('open', open);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menu?.classList.remove('open');
  });
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('visible'));
} else {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  revealItems.forEach((item) => observer.observe(item));
}

document.querySelectorAll('[data-year]').forEach((item) => {
  item.textContent = new Date().getFullYear();
});

// Native video remains usable without JavaScript. Only explicit user actions
// start playback; language changes deliberately stop and reset the timeline.
const video = document.querySelector('#product-video');
const languageButtons = [...document.querySelectorAll('[data-language]')];
const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
const demoStatus = document.querySelector('[data-demo-status]');
const mediaRoot = '/assets/tour-v1';
const demoLanguages = {
  en: { name: 'English', chapters: { catalog: 17.4, admin: 50.7, access: 69.5, connect: 104.6 } },
  it: { name: 'Italiano', chapters: { catalog: 18.2, admin: 52.5, access: 71.5, connect: 107 } },
};
let demoLanguage = 'en';
let pendingChapter = null;

const timestamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const clearActiveChapter = () => chapterButtons.forEach((button) => button.removeAttribute('aria-current'));

if (video) {
  document.querySelectorAll('[data-demo-controls]').forEach((element) => { element.hidden = false; });
  const playVideo = () => {
    video.play().catch(() => {
      demoStatus.textContent = 'Press Play in the video controls to start the demo.';
    });
  };
  const seekToChapter = (seconds) => {
    video.currentTime = seconds;
    pendingChapter = null;
  };
  video.addEventListener('loadedmetadata', () => {
    if (pendingChapter !== null) seekToChapter(pendingChapter);
  });

  languageButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const language = button.dataset.language;
      if (!demoLanguages[language] || language === demoLanguage) return;
      video.pause();
      pendingChapter = null;
      demoLanguage = language;
      video.querySelector('source').src = `${mediaRoot}/${language}/frontdoor-demo.mp4`;
      video.poster = `${mediaRoot}/${language}/02-governed-catalog.webp`;
      video.setAttribute('aria-label', `Frontdoor product demo — ${demoLanguages[language].name}`);
      // Replace the track, rather than retaining stale cues from the other language.
      const previousTrack = video.querySelector('track');
      const captionsEnabled = previousTrack.track.mode === 'showing';
      previousTrack.remove();
      const track = document.createElement('track');
      track.kind = 'captions';
      track.src = `${mediaRoot}/${language}/captions.vtt`;
      track.srclang = language;
      track.label = demoLanguages[language].name;
      track.default = captionsEnabled;
      video.append(track);
      if (captionsEnabled) track.track.mode = 'showing';
      video.load();
      clearActiveChapter();
      languageButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      chapterButtons.forEach((item) => {
        item.querySelector('time').textContent = timestamp(demoLanguages[language].chapters[item.dataset.chapter]);
      });
      const transcript = document.querySelector('[data-transcript]');
      transcript.href = `${mediaRoot}/${language}/transcript.html?v=2`;
      transcript.textContent = language === 'it' ? 'Leggi la trascrizione ↗' : 'Read the transcript ↗';
      transcript.lang = language;
      demoStatus.textContent = `${demoLanguages[language].name} selected. Press Play to start from the beginning.`;
    });
  });

  chapterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const seconds = demoLanguages[demoLanguage].chapters[button.dataset.chapter];
      if (video.readyState >= 1) {
        seekToChapter(seconds);
      } else {
        pendingChapter = seconds;
        video.load();
      }
      playVideo();
      demoStatus.textContent = `Opening chapter at ${timestamp(seconds)}.`;
    });
  });

  video.addEventListener('timeupdate', () => {
    const active = [...chapterButtons].reverse().find((button) =>
      video.currentTime >= demoLanguages[demoLanguage].chapters[button.dataset.chapter]);
    chapterButtons.forEach((button) => {
      if (button === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  });
  video.addEventListener('error', () => {
    pendingChapter = null;
    demoStatus.textContent = 'The video could not load. Use the EN or IT video link below the player.';
  });
  video.querySelector('source').addEventListener('error', () => {
    demoStatus.textContent = 'The video could not load. Use the EN or IT video link below the player.';
  });
}

const screenButtons = [...document.querySelectorAll('[data-screen]')];
const tourPanels = [...document.querySelectorAll('[data-tour-panel]')];
const tourStatus = document.querySelector('[data-tour-status]');
const imageLanguageButtons = [...document.querySelectorAll('[data-image-language]')];
let imageLanguage = 'en';

if (screenButtons.length && tourPanels.length) {
  document.querySelector('.tour-layout').classList.add('is-interactive');
  document.querySelectorAll('[data-tour-controls]').forEach((element) => { element.hidden = false; });
  const showScreen = (name, announce = true) => {
    tourPanels.forEach((panel) => { panel.hidden = panel.dataset.tourPanel !== name; });
    screenButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.screen === name)));
    const active = tourPanels.find((panel) => panel.dataset.tourPanel === name);
    if (announce) tourStatus.textContent = `${active.querySelector('h3').textContent} ${imageLanguage.toUpperCase()} screenshot.`;
  };
  screenButtons.forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen)));
  imageLanguageButtons.forEach((button) => button.addEventListener('click', () => {
    const language = button.dataset.imageLanguage;
    if (!demoLanguages[language] || language === imageLanguage) return;
    imageLanguage = language;
    tourPanels.forEach((panel) => {
      const img = panel.querySelector('[data-asset]');
      const url = `${mediaRoot}/${language}/${img.dataset.asset}.webp`;
      img.src = url;
      panel.querySelectorAll('[data-full-image]').forEach((link) => { link.href = url; });
    });
    imageLanguageButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    tourStatus.textContent = `${demoLanguages[language].name} screenshots selected.`;
  }));
  showScreen('catalog', false);
}
