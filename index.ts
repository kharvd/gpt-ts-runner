import { newAsyncContext } from "quickjs-emscripten";
import { JsInteraction } from "./js_interaction.js";
import { z } from "zod";
import { interaction } from "./interaction.js";
import { logTool, tool } from "./tool.js";
import { defaultJsPrompt } from "./prompt.js";
import { AnthropicLlmModel, OpenAiLlmModel } from "./llm.js";

// async function getWeather(location: { lat: number; lon: number }) {
//   const weather = await fetch(
//     `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,wind_speed_10m`
//   );
//   const data = await weather.json();
//   return {
//     temperature: data.current.temperature_2m,
//     windSpeed: data.current.wind_speed_10m,
//   };
// }

async function customFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  return await response.text();
}

// const weatherTool = tool((t) =>
//   t
//     .name("getWeather")
//     .description("Get the weather for a location")
//     .parameter(
//       "location",
//       z.object({
//         lat: z.number(),
//         lon: z.number(),
//       }),
//       "The location to get the weather for"
//     )
//     .returnType(
//       z.promise(z.object({ temperature: z.number(), windSpeed: z.number() }))
//     )
//     .impl((_, ...args) => getWeather(...args))
// );

const fetchTool = tool((t) =>
  t
    .name("fetchSync")
    .description(
      "Fetch a URL. Note that it is a synchronous fetch that always returns a string."
    )
    .parameter("url", z.string(), "The URL to fetch")
    .parameter(
      "init",
      z
        .object({
          method: z.string().optional(),
          headers: z.record(z.string()).optional(),
          body: z.string().optional(),
        })
        .optional(),
      "The fetch options"
    )
    .returnType(z.promise(z.string()))
    .impl((_, ...args) => customFetch(...args))
);

async function main() {
  const context = await newAsyncContext();

  const inter = new JsInteraction(
    context,
    interaction()
      .prompt(defaultJsPrompt)
      .tool(logTool)
      // .tool(weatherTool)
      .tool(fetchTool)
      .returnType(z.string())
      .example((e) =>
        e
          .message(
            "user",
            "Please only respond in JavaScript code. Make sure to log intermediate results and wait for my input before continuing."
          )
          .message(
            "assistant",
            "<javascript>",
            "respond(`Understood. I will only respond with JavaScript code from now on.",
            "Here are my guidelines for interacting with you:",
            "  - Break down complex problems into smaller parts, log intermediate results",
            "  - Double-check the context in which I use certain statements",
            "  - Ensure the structure of my code blocks is correct",
            "  - Never redeclare variables`);",
            "</javascript>"
          )
      )
      .example((e) =>
        e
          .message("user", "What is 128 * 481023?")
          .message(
            "assistant",
            "<javascript>",
            "respond((128 * 481023).toString());",
            "</javascript>"
          )
      )
      .example((e) =>
        e
          .message("user", "What is the weather in New York?")
          .message(
            "assistant",
            "<javascript>",
            "// Let's use api.open-meteo.com to get the weather",
            "coords = { lat: 40.7128, lon: -74.0060 };",
            "url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,wind_speed_10m`;",
            "weather = fetchSync(url);",
            "",
            "// Now, let's see what the weather is",
            "log(weather);",
            "</javascript>"
          )
          .message(
            "user",
            "<log>",
            '{"latitude":40.710335,"longitude":-73.99307,"generationtime_ms":0.024080276489257812,"utc_offset_seconds":0,"timezone":"GMT","timezone_abbreviation":"GMT","elevation":32.0,"current_units":{"time":"iso8601","interval":"seconds","temperature_2m":"°C","wind_speed_10m":"km/h"},"current":{"time":"2024-03-22T02:15","interval":900,"temperature_2m":0.9,"wind_speed_10m":15.8}}',
            "</log>"
          )
          .message(
            "assistant",
            "<javascript>",
            "// I can now respond with the weather",
            'respond("The weather in New York is rather cold, 0.9°C. Make sure to dress appropriately!");',
            "</javascript>"
          )
      )
      .example((e) =>
        e
          .message("user", "who is the current president of Argentina?")
          .message(
            "assistant",
            "<javascript>",
            "// Let's use the Wikipedia API to find the current president of Argentina",
            'url = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles=President_of_Argentina&redirects=true&exintro=true&explaintext=true";',
            "response = fetchSync(url);",
            "",
            "// Now, let's see what we got",
            "log(response);",
            "</javascript>"
          )
          .message(
            "user",
            "<log>",
            '{"batchcomplete":"","query":{"normalized":[{"from":"President_of_Argentina","to":"President of Argentina"}],"pages":{"229473":{"pageid":229473,"ns":0,"title":"President of Argentina","extract":"The president of Argentina (Spanish: Presidente de Argentina; officially known as the president of the Argentine Nation Spanish: Presidente de la Naci\\u00f3n Argentina) is both head of state and head of government of Argentina. Under the national constitution, the president is also the chief executive of the federal government and commander-in-chief of the armed forces.\\nThroughout Argentine history, the office of head of state has undergone many changes, both in its title as in its features and powers. The current president Javier Milei was sworn into office on 10 December 2023. He succeeded Alberto Fern\\u00e1ndez. \\nThe constitution of Argentina, along with several constitutional amendments, establishes the requirements, powers, and responsibilities of the president, the term of office and the method of election."}}}}',
            "</log>"
          )
          .message(
            "assistant",
            "<javascript>",
            'respond("The current president of Argentina is Javier Milei. He was sworn into office on 10 December 2023.");',
            "</javascript>"
          )
      )
      .build(),
    // new OpenAiLlmModel("gpt-4-turbo-preview")
    new AnthropicLlmModel("claude-3-opus-20240229")
  );

  const result = await inter.runInteraction();
  console.log("Result:", result);

  context.dispose();

  console.log("done");
}

main();
