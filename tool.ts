import { ZodType, ZodTypeAny, z } from "zod";
import { printNode, zodToTs } from "zod-to-ts";

type ParameterDef<ParamType> = {
  name: string;
  type: ZodType<ParamType>;
  description?: string;
};

type ParameterDefs<ParamType extends unknown[]> = ParamType extends [
  infer Param,
  ...infer Rest,
]
  ? [ParameterDef<Param>, ...ParameterDefs<Rest>]
  : [];

export type Tool<ReturnType> = {
  name: string;
  description: string;
  parameters: ParameterDef<unknown>[];
  returnType: ZodType<ReturnType>;
  impl: (...param: unknown[]) => unknown;
};

export interface ToolNameStep {
  name(name: string): DescriptionStep;
}

interface DescriptionStep {
  description(description: string): ReturnTypeStep<[]>;
}

interface ReturnTypeStep<ParamType extends unknown[]> {
  parameter<NextParamType>(
    name: string,
    paramType: ZodType<NextParamType>,
    description?: string
  ): ReturnTypeStep<[...ParamType, NextParamType]>;

  returnType<ReturnType>(
    returnType: ZodType<ReturnType>
  ): ImplStep<ParamType, ReturnType>;
}

interface ImplStep<ParamType extends unknown[], ReturnType> {
  impl(func: (...param: ParamType) => ReturnType): Tool<ReturnType>;
}

export class ToolBuilder<ParamType extends unknown[], ReturnType> {
  private _name!: string;
  private _description!: string;
  private _parameters: ParameterDef<any>[] = [];
  private _returnType!: ZodType<any>;

  name(name: string): DescriptionStep {
    this._name = name;
    return this;
  }

  description(description: string): ReturnTypeStep<[]> {
    this._description = description;
    return this as unknown as ReturnTypeStep<[]>;
  }

  parameter<NextParamType>(
    name: string,
    paramType: ZodType<NextParamType>,
    description?: string
  ): ReturnTypeStep<[...ParamType, NextParamType]> {
    this._parameters.push({
      name,
      description,
      type: paramType,
    });
    return this as unknown as ReturnTypeStep<[...ParamType, NextParamType]>;
  }

  returnType<NewReturnType>(
    returnType: ZodType<NewReturnType>
  ): ImplStep<ParamType, NewReturnType> {
    this._returnType = returnType;
    return this as unknown as ImplStep<ParamType, NewReturnType>;
  }

  impl(func: (...param: ParamType) => ReturnType): Tool<ReturnType> {
    const tool = {
      name: this._name,
      description: this._description,
      parameters: this._parameters as ParameterDefs<ParamType>,
      returnType: this._returnType,
      impl: func as (...param: unknown[]) => unknown,
    };

    this._reset();

    return tool;
  }

  private _reset() {
    this._name = undefined!;
    this._description = undefined!;
    this._parameters = [];
    this._returnType = undefined!;
  }
}

function serializeType(type: ZodTypeAny): string {
  const node = zodToTs(type).node;
  return printNode(node);
}

export function toolToTs(tool: Tool<unknown>): string {
  const parameterTypes = tool.parameters
    .map((param) => `${param.name}: ${serializeType(param.type)}`)
    .join(", ");
  const returnType = serializeType(tool.returnType);

  let tsDoc = `/**\n * ${tool.description}\n`;
  for (const param of tool.parameters) {
    tsDoc += ` * @param ${param.name} ${param.description ?? ""}\n`;
  }
  tsDoc += ` */`;

  return `${tsDoc}\nfunction ${tool.name}(${parameterTypes}): ${returnType}`;
}
