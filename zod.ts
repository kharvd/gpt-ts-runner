import { QuickJSContext, QuickJSHandle } from "quickjs-emscripten";
import {
  RawCreateParams,
  z,
  ZodRawShape,
  ZodType,
  ZodTypeAny,
  ZodTypeDef,
} from "zod";

export function transformSchema(
  vm: QuickJSContext,
  schema: ZodTypeAny
): ZodType<QuickJSHandle, ZodTypeDef, any> {
  if (schema instanceof z.ZodString) {
    return schema.transform((val) => vm.newString(val));
  }

  if (schema instanceof z.ZodNumber) {
    return schema.transform((val) => vm.newNumber(val));
  }

  if (schema instanceof z.ZodBoolean) {
    return schema.transform((val) => (val ? vm.true : vm.false));
  }

  if (schema instanceof z.ZodNull) {
    return schema.transform(() => vm.null);
  }

  if (schema instanceof z.ZodUndefined) {
    return schema.transform(() => vm.undefined);
  }

  if (schema instanceof z.ZodBigInt) {
    return schema.transform((val) => vm.newBigInt(val));
  }

  if (schema instanceof z.ZodObject) {
    const newShape: ZodRawShape = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      newShape[key] = transformSchema(vm, value as ZodTypeAny);
    }
    return z.object(newShape).transform((val) => {
      const obj = vm.newObject();
      for (const [key, value] of Object.entries(val)) {
        vm.setProp(obj, key, value);
      }
      return obj;
    });
  }

  if (schema instanceof z.ZodArray) {
    const newSchema = transformSchema(vm, schema.element);
    return z.array(newSchema).transform((val) => {
      const arr = vm.newArray();
      for (let i = 0; i < val.length; i++) {
        vm.setProp(arr, i, val[i]);
      }
      return arr;
    });
  }

  if (schema instanceof z.ZodUnion) {
    const newSchemas = schema.options.map((option: ZodTypeAny) =>
      transformSchema(vm, option)
    );
    return z.union(newSchemas);
  }

  throw new Error("Unsupported schema type");
}
