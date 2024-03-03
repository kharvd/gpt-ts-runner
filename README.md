## Example

```bash
yarn run start "Using a random number generator, pick a random city. Then write a haiku about the weather there"
```

Output

```
[system]
You are running in an interactive sandboxed JavaScript environment. You will ONLY write JavaScript code to respond to user's input. The environment has only access to built-in JavaScript APIs: no Web or Node.js. If you need to inspect the result of your code, use the `log` function. The result will be returned in a follow-up message.

### Output format
Regardless of the user's request, you should ONLY produce valid JavaScript code surrounded by Markdown code fences. ALWAYS start your message with \`\`\`javascript

### Available globals
/**
 * Print the given object to the console for inspection. The user will not see the output of this function.
 * @param obj The object to inspect
 */
function log(obj: any): void | undefined

/**
 * Get the weather for a location
 * @param location The location to get the weather for
 */
function getWeather(location: {
    lat: number;
    lon: number;
}): {
    temperature: number;
    windSpeed: number;
}

/**
 * Conclude the conversation by producing the result. The function can only be called once per session.
 * @param result The result of the interactive session
 */
function respond(result: string): never

### Examples
#### Example 1
<im_start>user
What is 128 * 481023?<im_end>
<im_start>assistant
\`\`\`javascript
// I will simply calculate the result and respond with it
respond((128 * 481023).toString());
\`\`\`<im_end>

#### Example 2
<im_start>user
What is the weather in New York?<im_end>
<im_start>assistant
\`\`\`javascript
// Let's use the provided getWeather function to get the weather in New York
const weather = getWeather({ lat: 40.7128, lon: -74.0060 });
// Now, let's see what the weather is
log(weather);
\`\`\`<im_end>
<im_start>user
log:
{ temperature: 75, windSpeed: 5 }<im_end>
<im_start>assistant
\`\`\`javascript
// I can now respond with the weather
respond("The weather in New York is sunny, high of 75. It's a beautiful day!");
\`\`\`<im_end>


[user]
Using a random number generator, pick a random city. Then write a haiku about the weather there

[assistant]
\`\`\`javascript
// First, let's define a list of cities with their latitude and longitude
const cities = [
    { name: "Tokyo", lat: 35.6895, lon: 139.6917 },
    { name: "Paris", lat: 48.8566, lon: 2.3522 },
    { name: "New York", lat: 40.7128, lon: -74.0060 },
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    { name: "Cairo", lat: 30.0444, lon: 31.2357 },
    { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 }
];

// Now, let's pick a random city from the list
const randomIndex = Math.floor(Math.random() * cities.length);
const selectedCity = cities[randomIndex];

// Let's use the getWeather function to get the weather for the selected city
const weather = getWeather({ lat: selectedCity.lat, lon: selectedCity.lon });

// We'll log the selected city and its weather to decide on the haiku
log({ city: selectedCity.name, weather });
\`\`\`

Executing JS
// First, let's define a list of cities with their latitude and longitude
const cities = [
    { name: "Tokyo", lat: 35.6895, lon: 139.6917 },
    { name: "Paris", lat: 48.8566, lon: 2.3522 },
    { name: "New York", lat: 40.7128, lon: -74.0060 },
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    { name: "Cairo", lat: 30.0444, lon: 31.2357 },
    { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 }
];

// Now, let's pick a random city from the list
const randomIndex = Math.floor(Math.random() * cities.length);
const selectedCity = cities[randomIndex];

// Let's use the getWeather function to get the weather for the selected city
const weather = getWeather({ lat: selectedCity.lat, lon: selectedCity.lon });

// We'll log the selected city and its weather to decide on the haiku
log({ city: selectedCity.name, weather });
[user]
[log] { city: 'Tokyo', weather: { temperature: 11.5, windSpeed: 6.5 } }

[assistant]
\`\`\`javascript
// Based on the weather in Tokyo, let's write a haiku
const haiku = `Chilly Tokyo,\nWhispers of wind through the streets,\nSpring's breath still so cold.`;

// Now, let's respond with the haiku
respond(haiku);
\`\`\`

Executing JS
// Based on the weather in Tokyo, let's write a haiku
const haiku = `Chilly Tokyo,\nWhispers of wind through the streets,\nSpring's breath still so cold.`;

// Now, let's respond with the haiku
respond(haiku);
Result: Chilly Tokyo,
Whispers of wind through the streets,
Spring's breath still so cold.
done
```
