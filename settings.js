import { watchFile, unwatchFile } from "fs";
import chalk from "chalk";
import { fileURLToPath } from "url";
import path from "path";

global.owner = ['573115975891', '50498273976'];

// Si se define la variable de entorno DATA_DIR (ej. un Volume en Railway montado en /data),
// la base de datos y las sesiones se guardan ahí para no perderse en cada redeploy.
// Si no está definida, se comporta como antes (rutas relativas al proyecto).
global.dataDir = process.env.DATA_DIR || null;
global.sessionsDir = global.dataDir ? path.join(global.dataDir, 'Sessions') : './Sessions';

global.dev = "© ⍴᥆ᥕᥱrᥱძ ᑲᥡ ⁱᵃᵐ|𝔇ĕ𝐬†𝓻⊙γ𒆜";
global.links = {
  api: 'https://api.yuki-wabot.my.id',
  channel: "https://whatsapp.com/channel/0029Vb64nWqLo4hb8cuxe23n",
  github: "https://github.com/iamDestroy/YukiBot-MD",
  gmail: "thekingdestroy507@gmail.com"
}
global.my = {
  ch1: '120363401404146384@newsletter'
};

global.APIs = { 
  evogb: { url: "https://api.evogb.org", key: "alefox" },
  yuki: { url: "https://api.yuki-wabot.my.id", key: "YukiBot-MD" },
  vreden: { url: "https://api.vreden.web.id", key: null },
  ootaizumi: { url: "https://api.ootaizumi.web.id", key: null },
  delirius: { url: "https://api.delirius.store", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://app.siputzx.my.id", key: null }
};

global.mess = {
  socket: '《✧》 Este comando solo puede ser ejecutado por un Socket.',
  admin: '《✧》 Este comando solo puede ser ejecutado por los Administradores del Grupo.',
  botAdmin: '《✧》 Este comando solo puede ser ejecutado si el Socket es Administrador del Grupo.'
};

let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  import(`${file}?update=${Date.now()}`);
});
