import { Platform } from "react-native";

let MapView: any = null;
let Circle: any = null;
let Marker: any = null;

if (Platform.OS !== "web") {
  try {
    const requireFunc = eval("require");
    const moduleName = ["react", "-native", "-maps"].join("");
    const mapModule = requireFunc(moduleName);
    MapView = mapModule.default;
    Circle = mapModule.Circle;
    Marker = mapModule.Marker;
  } catch {
    // react-native-maps is only available on native platforms.
  }
}

export { Circle, MapView, Marker };
