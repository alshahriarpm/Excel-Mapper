import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeScript({ theme }: { theme: string }) {
  const code = `(function(){try{
var s=${JSON.stringify(THEME_STORAGE_KEY)};
var t=${JSON.stringify(theme)};
var stored=localStorage.getItem(s);
if(stored==="light"||stored==="dark"||stored==="system"){t=stored}else{localStorage.setItem(s,t)}
var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",dark);
document.documentElement.style.colorScheme=dark?"dark":"light";
}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
