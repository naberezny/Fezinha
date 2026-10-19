import { addIcons } from 'ionicons';
import {
  diceOutline,
  homeOutline,
  listOutline,
  moonOutline,
  statsChartOutline,
  sunnyOutline,
} from 'ionicons/icons';

/** Registra os ícones usados na navegação (barra superior e tab bar). Idempotente: importe pelo efeito. */
addIcons({
  'dice-outline': diceOutline,
  'home-outline': homeOutline,
  'list-outline': listOutline,
  'stats-chart-outline': statsChartOutline,
  'moon-outline': moonOutline,
  'sunny-outline': sunnyOutline,
});
