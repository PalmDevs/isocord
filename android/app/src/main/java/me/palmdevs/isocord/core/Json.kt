package me.palmdevs.isocord.core

import android.util.Log
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement

private const val TAG = "IsocordJson"

/** Shared lenient decoder for JSON props coming from JS. */
val AppJson = Json {
  ignoreUnknownKeys = true
  explicitNulls = false
  coerceInputValues = true
}

/** Decodes [json], or logs and returns null when it is malformed or does not fit [strategy]. */
fun <T> decodeOrNull(strategy: DeserializationStrategy<T>, json: String): T? =
  try {
    AppJson.decodeFromString(strategy, json)
  } catch (e: SerializationException) {
    logSkipped(strategy, e)
    null
  }

/** Decodes [element], or logs and returns null when it does not fit [strategy]. */
fun <T> decodeOrNull(strategy: DeserializationStrategy<T>, element: JsonElement): T? =
  try {
    AppJson.decodeFromJsonElement(strategy, element)
  } catch (e: SerializationException) {
    logSkipped(strategy, e)
    null
  }

/** Decodes a JSON array item by item. A bad item is logged and skipped. */
fun <T> decodeEach(strategy: DeserializationStrategy<T>, json: String?): List<T> {
  if (json.isNullOrEmpty()) return emptyList()
  val items = decodeOrNull(JsonArray.serializer(), json) ?: return emptyList()
  return items.mapNotNull { decodeOrNull(strategy, it) }
}

// The exception message quotes the input, which can hold message text: log the class only.
private fun logSkipped(strategy: DeserializationStrategy<*>, e: SerializationException) =
  Log.w(TAG, "Skipped a bad ${strategy.descriptor.serialName}: ${e.javaClass.simpleName}")
