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
    const newShape: Record<string, ZodType<QuickJSHandle>> = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      newShape[key] = transformSchema(vm, value as ZodTypeAny);
    }
    return z.object(newShape).transform((val) => {
      const obj = vm.newObject();
      for (const [key, value] of Object.entries(val)) {
        value.consume((v) => vm.setProp(obj, key, v));
      }
      return obj;
    });
  }

  if (schema instanceof z.ZodArray) {
    const newSchema = transformSchema(vm, schema.element);
    return z.array(newSchema).transform((val) => {
      const arr = vm.newArray();
      for (let i = 0; i < val.length; i++) {
        val[i].consume((v) => vm.setProp(arr, i, v));
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

  if (schema instanceof z.ZodPromise) {
    const newSchema = transformSchema(vm, schema.unwrap());
    return z.promise(newSchema).transform((promise) => {
      const newPromise = vm.newPromise();
      promise
        .then((val) => {
          val.consume((result) => newPromise.resolve(result));
        })
        .catch((err) => {
          vm.newError(err.message).consume((error) => newPromise.reject(error));
        });

      newPromise.settled.then(() => {
        vm.runtime.executePendingJobs();
      });

      return newPromise.handle;
    });
  }

  throw new Error("Unsupported schema type");
}
