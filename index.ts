import { newAsyncContext } from "quickjs-emscripten";
import { JsInteraction } from "./js_interaction.js";
import { z } from "zod";
import { interaction } from "./interaction.js";
import { logTool, tool } from "./tool.js";
import { defaultJsPrompt } from "./prompt.js";

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

const weatherTool = tool((t) =>
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
    .impl(getWeather)
);

async function main() {
  const context = await newAsyncContext();

  const inter = new JsInteraction(
    context,
    interaction()
      .prompt(defaultJsPrompt)
      .tool(logTool)
      .tool(weatherTool)
      .returnType(z.string())
      .example((e) =>
        e
          .message("user", "What is 128 * 481023?")
          .message(
            "assistant",
            "```javascript",
            "// I will simply calculate the result and respond with it",
            "respond((128 * 481023).toString());",
            "```"
          )
      )
      .example((e) =>
        e
          .message("user", "What is the weather in New York?")
          .message(
            "assistant",
            "```javascript",
            "// Let's use the provided getWeather function to get the weather in New York",
            "const weather = getWeather({ lat: 40.7128, lon: -74.0060 });",
            "// Now, let's see what the weather is",
            "log(weather);",
            "```"
          )
          .message("user", "log:", "{ temperature: 75, windSpeed: 5 }")
          .message(
            "assistant",
            "```javascript",
            "// I can now respond with the weather",
            'respond("The weather in New York is sunny, high of 75. It\'s a beautiful day!");',
            "```"
          )
      )
      .build()
  );

  const result = await inter.runInteraction(process.argv[2]);
  console.log("Result:", result);

  context.dispose();

  console.log("done");
}

main();
