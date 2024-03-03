import {
  getQuickJS,
  newQuickJSWASMModule,
  DEBUG_SYNC,
  TestQuickJSWASMModule,
} from "quickjs-emscripten";
import { JsInteraction } from "./js_interaction.js";
import { z } from "zod";

async function getWeather(location: { lat: number; lon: number }) {
  const weather = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,wind_speed_10m`
  );
  const data = await weather.json();
  return {
    temperature: data.current.temperature_2m,
    windSpeed: data.current.wind_speed_10m,
  };
}

async function main() {
  // const QuickJS = new TestQuickJSWASMModule(
  //   await newQuickJSWASMModule(DEBUG_SYNC)
  // );
  const QuickJS = await getQuickJS();
  const context = QuickJS.newContext();
  // const QuickJS = await newQuickJSWASMModule(DEBUG_SYNC);
  const interaction = new JsInteraction(context, (t) => [
    t
      .name("getWeather")
      .description("Get the weather for a location")
      .parameter(
        "location",
        z.object({
          lat: z.number(),
          lon: z.number(),
        }),
        "The location to get the weather for"
      )
      .returnType(
        z.promise(z.object({ temperature: z.number(), windSpeed: z.number() }))
      )
      .impl(getWeather),
  ]);

  await interaction.runInteraction(process.argv[2]);

  context.dispose();

  // QuickJS.assertNoMemoryAllocated();

  console.log("done");
}

main();
