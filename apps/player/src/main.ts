import { createApp } from "vue";
import App from "./App.vue";
import Spectator from "./Spectator.vue";
import "./styles.css";

const params = new URLSearchParams(location.search);
createApp(params.has("archive") || params.has("world") || params.has("replay") ? App : Spectator).mount("#app");
