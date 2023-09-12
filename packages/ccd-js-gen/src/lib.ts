import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as tsm from 'ts-morph';
import * as SDK from '@concordium/common-sdk';

/**
 * Output options for the generated code.
 * - 'TypeScript' Only produce a module in TypeScript.
 * - 'JavaScript' Only produce a module in JavaScript.
 * - 'TypedJavaScript' Produce a JavaScript module and TypeScript declarations.
 * - 'Everything' Produce all of the above.
 */
export type OutputOptions =
    | 'TypeScript'
    | 'JavaScript'
    | 'TypedJavaScript'
    | 'Everything';

/** Options for generating clients */
export type GenerateContractClientsOptions = {
    /** Options for the output */
    output?: OutputOptions;
};

/**
 * Generate smart contract client code for a given smart contract module file.
 * @param modulePath Path to the smart contract module.
 * @param outDirPath Path to the directory to use for the output.
 * @param options Options for generating the clients.
 * @throws If unable to: read provided file at `modulePath`, parse the provided smart contract module or write to provided directory `outDirPath`.
 */
export async function generateContractClientsFromFile(
    modulePath: string,
    outDirPath: string,
    options: GenerateContractClientsOptions = {}
): Promise<void> {
    const fileBytes = await fs.readFile(modulePath).catch((e) => {
        if ('code' in e && e.code === 'ENOENT') {
            throw new Error(`No such module '${modulePath}'`);
        }
        throw e;
    });
    const outputName = path.basename(modulePath, '.wasm.v1');
    const moduleSource = SDK.versionedModuleSourceFromBuffer(fileBytes);
    return generateContractClients(
        moduleSource,
        outputName,
        outDirPath,
        options
    );
}

/**
 * Generate smart contract client code for a given smart contract module.
 * @param moduleSource Buffer with bytes for the smart contract module.
 * @param outName Name for the output file.
 * @param outDirPath Path to the directory to use for the output.
 * @param options Options for generating the clients.
 * @throws If unable to write to provided directory `outDirPath`.
 */
export async function generateContractClients(
    moduleSource: SDK.VersionedModuleSource,
    outName: string,
    outDirPath: string,
    options: GenerateContractClientsOptions = {}
): Promise<void> {
    const outputOption = options.output ?? 'Everything';
    const moduleInterface = await SDK.parseModuleInterface(moduleSource);
    const outputFilePath = path.format({
        dir: outDirPath,
        name: outName,
        ext: '.ts',
    });

    const compilerOptions: tsm.CompilerOptions = {
        outDir: outDirPath,
        declaration:
            outputOption === 'Everything' || outputOption === 'TypedJavaScript',
    };
    const project = new tsm.Project({ compilerOptions });
    const sourceFile = project.createSourceFile(outputFilePath, '', {
        overwrite: true,
    });
    addModuleClients(sourceFile, moduleInterface);
    if (outputOption === 'Everything' || outputOption === 'TypeScript') {
        await project.save();
    }
    if (
        outputOption === 'Everything' ||
        outputOption === 'JavaScript' ||
        outputOption === 'TypedJavaScript'
    ) {
        await project.emit();
    }
}

/** Iterates a module interface adding code to the provided source file. */
function addModuleClients(
    sourceFile: tsm.SourceFile,
    moduleInterface: SDK.ModuleInterface
) {
    sourceFile.addImportDeclaration({
        namespaceImport: 'SDK',
        moduleSpecifier: '@concordium/common-sdk',
    });

    for (const contract of moduleInterface.values()) {
        const contractNameId = 'contractName';
        const genericContractId = 'genericContract';
        const grpcClientId = 'grpcClient';
        const contractAddressId = 'contractAddress';
        const dryRunId = 'dryRun';
        const contractClassId = toPascalCase(contract.contractName);
        const contractDryRunClassId = `${contractClassId}DryRun`;

        const classDecl = sourceFile.addClass({
            docs: ['Smart contract client for a contract instance on chain.'],
            isExported: true,
            name: contractClassId,
            properties: [
                {
                    docs: [
                        'Name of the smart contract supported by this client.',
                    ],
                    scope: tsm.Scope.Public,
                    isReadonly: true,
                    name: contractNameId,
                    type: 'string',
                    initializer: `'${contract.contractName}'`,
                },
                {
                    docs: ['Generic contract client used internally.'],
                    scope: tsm.Scope.Private,
                    name: genericContractId,
                    type: 'SDK.Contract',
                },
                {
                    docs: ['Dry run entrypoints of the smart contract.'],
                    scope: tsm.Scope.Public,
                    isReadonly: true,
                    name: dryRunId,
                    type: contractDryRunClassId,
                },
            ],
        });

        const dryRunClassDecl = sourceFile.addClass({
            docs: [
                `Smart contract client for dry running messages to a contract instance of '${contract.contractName}' on chain.`,
            ],
            isExported: true,
            name: contractDryRunClassId,
        });

        classDecl
            .addConstructor({
                docs: ['Contruct a client for a contract instance on chain'],
                parameters: [
                    {
                        name: grpcClientId,
                        type: 'SDK.ConcordiumGRPCClient',
                        scope: tsm.Scope.Public,
                    },
                    {
                        name: contractAddressId,
                        type: 'SDK.ContractAddress',
                        isReadonly: true,
                        scope: tsm.Scope.Public,
                    },
                ],
            })
            .setBodyText(
                `this.${genericContractId} = new SDK.Contract(${grpcClientId}, ${contractAddressId}, '${contract.contractName}');
this.${dryRunId} = new ${contractDryRunClassId}(this.${genericContractId});`
            );

        dryRunClassDecl.addConstructor({
            docs: ['Contruct a client for a contract instance on chain'],
            parameters: [
                {
                    name: genericContractId,
                    type: 'SDK.Contract',
                    scope: tsm.Scope.Private,
                },
            ],
        });

        for (const entrypointName of contract.entrypointNames) {
            const transactionMetadataId = 'transactionMetadata';
            const parameterId = 'parameter';
            const signerId = 'signer';
            classDecl
                .addMethod({
                    docs: [
                        `Send an update-contract transaction to the '${entrypointName}' entrypoint of the '${contract.contractName}' contract.

@param {SDK.ContractTransactionMetadata} ${transactionMetadataId} - Hex encoded parameter for entrypoint
@param {SDK.HexString} ${parameterId} - Hex encoded parameter for entrypoint
@param {SDK.AccountSigner} ${signerId} - The signer of the update contract transaction.

@throws If the entrypoint is not successfully invoked.

@returns {SDK.HexString} Transaction hash`,
                    ],
                    scope: tsm.Scope.Public,
                    name: toCamelCase(entrypointName),
                    parameters: [
                        {
                            name: transactionMetadataId,
                            type: 'SDK.ContractTransactionMetadata',
                        },
                        {
                            name: parameterId,
                            type: 'SDK.HexString',
                        },
                        {
                            name: signerId,
                            type: 'SDK.AccountSigner',
                        },
                    ],
                    returnType: 'Promise<SDK.HexString>',
                })
                .setBodyText(
                    `return this.${genericContractId}.createAndSendUpdateTransaction(
    '${entrypointName}',
    SDK.encodeHexString,
    ${transactionMetadataId},
    ${parameterId},
    ${signerId}
);`
                );
            const blockHashId = 'blockHash';
            dryRunClassDecl
                .addMethod({
                    docs: [
                        `Dry run an update-contract transaction to the '${entrypointName}' entrypoint of the '${contract.contractName}' contract.

@param {SDK.HexString} ${parameterId} - Hex encoded parameter for entrypoint
@param {SDK.HexString} [${blockHashId}] - Block hash of the block to invoke entrypoint at

@throws If the entrypoint is not successfully invoked.

returns {SDK.HexString} Hex encoded response`,
                    ],
                    scope: tsm.Scope.Public,
                    name: toCamelCase(entrypointName),
                    parameters: [
                        {
                            name: parameterId,
                            type: 'SDK.HexString',
                        },
                        {
                            name: blockHashId,
                            type: 'SDK.HexString',
                            hasQuestionToken: true,
                        },
                    ],
                    returnType: 'Promise<SDK.HexString>',
                })
                .setBodyText(
                    `return this.${genericContractId}.invokeView(
    '${entrypointName}',
    SDK.encodeHexString,
    (hex: SDK.HexString) => hex,
    ${parameterId},
    ${blockHashId}
);`
                );
        }
    }
}

/** Make the first character in a string uppercase */
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Convert a string in snake_case or kebab-case into camelCase.
 * This is used to transform entrypoint names in the smart contract to follow formatting javascript convention.
 */
function toCamelCase(str: string): string {
    return str
        .split(/[-_]/g)
        .map((word, index) => (index === 0 ? word : capitalize(word)))
        .join('');
}

/**
 * Convert a string in snake_case or kebab-case into PascalCase.
 * This is used to transform contract names in the smart contract to follow formatting javascript convention.
 */
function toPascalCase(str: string): string {
    return str.split(/[-_]/g).map(capitalize).join('');
}
