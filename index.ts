import { getQuickJS } from "quickjs-emscripten";
import { JsInteraction } from "./js_interaction.js";
import { z } from "zod";

async function main() {
  const QuickJS = await getQuickJS();
  using interaction = new JsInteraction(QuickJS, (t) => [
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
      .returnType(z.object({ temperature: z.number(), windSpeed: z.string() }))
      .impl(({ lat, lon }) => {
        // const weather = await fetch(
        //   `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`
        // );
        // const data = await weather.json();
        // return { temperature: data.current.temperature_2m }
        return {
          temperature: 75,
          windSpeed: "5 mph",
        };
      }),
  ]);

  await interaction.runInteraction(process.argv[2]);
}

main();
