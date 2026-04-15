import npyjs from 'npyjs'

export type NpyTypedArray =
  | Float32Array
  | Float64Array
  | Uint16Array
  | Uint8Array
  | Int32Array
  | Int16Array
  | Uint32Array
  | Uint8ClampedArray

export type SpectralCube = {
  data: NpyTypedArray
  shape: number[]
}

export async function loadNpy(filePath: string): Promise<SpectralCube> {
  const npy = new npyjs()
  const result = await npy.load(filePath)

  return {
    data: result.data as NpyTypedArray,
    shape: result.shape
  }
}
