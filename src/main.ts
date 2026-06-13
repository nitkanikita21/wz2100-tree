import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import IconRenderApp from './IconRenderApp.vue';
import './style.css';

const renderIconMode = new URLSearchParams(window.location.search).has('renderResearchIcon');
if (renderIconMode) {
  document.documentElement.classList.add('icon-render-mode');
  document.body.classList.add('icon-render-mode');
}

const Root = renderIconMode ? IconRenderApp : App;

createApp(Root).use(createPinia()).mount('#app');
