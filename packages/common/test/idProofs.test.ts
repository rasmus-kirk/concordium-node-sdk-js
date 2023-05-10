import { AttributeKeyString, AttributesKeys, IdDocType } from '../src/types';
import {
    StatementTypes,
    attributesWithRange,
    attributesWithSet,
    RangeStatement,
    IdStatementV2,
    IDENTITY_SUBJECT_SCHEMA,
} from '../src/idProofTypes';
import { getIdProof, IdStatementBuilder } from '../src/idProofs';
import fs from 'fs';
import { Web3StatementBuilder } from '../src';

test('Creating a statement with multiple atomic statements on the same attribute fails', () => {
    const builder = new IdStatementBuilder(true);
    expect(() =>
        builder
            .addRange(AttributesKeys.dob, '20001010', '20201010')
            .addRange(AttributesKeys.dob, '20001010', '20201010')
    ).toThrow();
    expect(() =>
        builder
            .addMembership(AttributesKeys.countryOfResidence, [])
            .addEUResidency()
    ).toThrow();
    expect(() =>
        builder
            .addNonMembership(AttributesKeys.countryOfResidence, ['DE'])
            .addNonMembership(AttributesKeys.countryOfResidence, ['DK', 'FR'])
    ).toThrow();
    expect(() =>
        builder
            .revealAttribute(AttributesKeys.countryOfResidence)
            .revealAttribute(AttributesKeys.countryOfResidence)
    ).toThrow();
    expect(() => builder.addMinimumAge(18).addMinimumAge(20)).toThrow();
});

test('Minimum age helper adds a range statement on date of birth', () => {
    const builder = new IdStatementBuilder(true);
    const statement = builder.addMinimumAge(18).getStatement();
    expect(statement[0].type).toBe(StatementTypes.AttributeInRange);
    expect(statement[0].attributeTag).toBe('dob');
});

test('Eu helpers adds a membership statement', () => {
    const builder = new IdStatementBuilder(true);
    const statement = builder
        .addEUResidency()
        .addEUNationality()
        .getStatement();
    expect(statement[0].type).toBe(StatementTypes.AttributeInSet);
    expect(statement[0].attributeTag).toBe('countryOfResidence');
    expect(statement[1].type).toBe(StatementTypes.AttributeInSet);
    expect(statement[1].attributeTag).toBe('nationality');
});

test('Only attributesWithRange can have range statements added', () => {
    const builder = new IdStatementBuilder(true);
    for (const x in AttributeKeyString) {
        if (!attributesWithRange.includes(x as AttributeKeyString)) {
            expect(() =>
                builder.addRange(
                    AttributesKeys[x as AttributeKeyString],
                    '20001010',
                    '20201010'
                )
            ).toThrow(x + ' is not allowed to be used in range statements');
        } else {
        }
    }
    expect(builder.getStatement().length).toBe(0);
});

test('Only attributesWithSet can have membership statements added', () => {
    const builder = new IdStatementBuilder(true);
    for (const x in AttributeKeyString) {
        if (!attributesWithSet.includes(x as AttributeKeyString)) {
            expect(() =>
                builder.addMembership(AttributesKeys[x as AttributeKeyString], [
                    'DK',
                    'DE',
                ])
            ).toThrow(
                x + ' is not allowed to be used in membership statements'
            );
        }
    }
    expect(builder.getStatement().length).toBe(0);
});

test('Upper bound must be greater than lower bound for attribute statement', () => {
    const builder = new IdStatementBuilder(true);
    expect(() => builder.addAgeInRange(30, 15)).toThrow();
});

test('Unknown attribute tags are rejected', () => {
    const builder = new IdStatementBuilder(true);
    expect(() => builder.addMembership(-1, ['DK'])).toThrow();
    expect(() => builder.addMembership(15, ['DK'])).toThrow();
    expect(() => builder.addMembership(1000, ['DK'])).toThrow();
});

test('Empty sets are rejected', () => {
    const builder = new IdStatementBuilder(true);
    expect(() =>
        builder.addMembership(AttributesKeys.countryOfResidence, [])
    ).toThrow();
    expect(() =>
        builder.addNonMembership(AttributesKeys.countryOfResidence, [])
    ).toThrow();
});

test('Can create id Proof', () => {
    const idObject = JSON.parse(
        fs.readFileSync('./test/resources/identity-object.json').toString()
    ).value;
    const globalContext = JSON.parse(
        fs.readFileSync('./test/resources/global.json').toString()
    ).value;

    const builder = new IdStatementBuilder(true);
    const statement = builder
        .addEUResidency()
        .addEUNationality()
        .addMinimumAge(18)
        .documentExpiryNoEarlierThan('20200101')
        .addMembership(6, [IdDocType.Passport])
        .getStatement();
    const challenge = 'AAAAAA';
    const proof = getIdProof({
        idObject,
        globalContext,
        seedAsHex:
            'efa5e27326f8fa0902e647b52449bf335b7b605adc387015ec903f41d95080eb71361cbc7fb78721dcd4f3926a337340aa1406df83332c44c1cdcfe100603860',
        net: 'Testnet',
        identityProviderIndex: 0,
        identityIndex: 0,
        credNumber: 1,
        statement,
        challenge,
    });
    expect(proof.credential).toEqual(
        'b317d3fea7de56f8c96f6e72820c5cd502cc0eef8454016ee548913255897c6b52156cc60df965d3efb3f160eff6ced4'
    );
    const proofValue = proof.proof.value.proofs;
    expect(proofValue.length).toBe(5);
    expect(proofValue[0].type).toBe(StatementTypes.AttributeInSet);
    expect(proofValue[1].type).toBe(StatementTypes.AttributeInSet);
    expect(proofValue[2].type).toBe(StatementTypes.AttributeInRange);
    expect(proofValue[0].proof).toBeDefined();
    expect(proofValue[1].proof).toBeDefined();
    expect(proofValue[2].proof).toBeDefined();
});

test('Non uppercase ISO3166_1Alpha2 are rejected', () => {
    const builder = new IdStatementBuilder(true);
    expect(() =>
        builder.addMembership(AttributesKeys.nationality, ['dk'])
    ).toThrow();
    expect(() =>
        builder.addMembership(AttributesKeys.nationality, ['Dk'])
    ).toThrow();
    expect(() =>
        builder.addMembership(AttributesKeys.nationality, ['dK'])
    ).toThrow();
    builder.addMembership(AttributesKeys.nationality, ['DK']);
    expect(builder.getStatement().length).toBe(1);
});

test('Maximum age 17 gives negative inf - 17.9999 range', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-02'));
    const builder = new IdStatementBuilder(true);
    const statement = builder
        .addMaximumAge(17)
        .getStatement()[0] as RangeStatement;
    expect(statement.upper).toBe('99990101');
    expect(statement.lower).toBe('20020103');
});

test('Age between 14 and 17 gives 14 - 17.9999 range', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-02'));
    const builder = new IdStatementBuilder(true);
    const statement = builder
        .addAgeInRange(14, 17)
        .getStatement()[0] as RangeStatement;
    expect(statement.upper).toBe('20060102');
    expect(statement.lower).toBe('20020103');
});

test('Age between 1 and 1 gives 1 - 1.9999 range', () => {
    jest.useFakeTimers().setSystemTime(new Date('2020-01-02'));
    const builder = new IdStatementBuilder(true);
    const statement = builder
        .addAgeInRange(1, 1)
        .getStatement()[0] as RangeStatement;
    expect(statement.upper).toBe('20190102');
    expect(statement.lower).toBe('20180103');
});

test('Generate V2 statement', () => {
    const builder = new Web3StatementBuilder();
    const statement = builder
        .addForVerifiableCredentials(
            [
                { index: 2101n, subindex: 0n },
                { index: 1337n, subindex: 42n },
            ],
            (b) =>
                b.addRange(17, 80n, 1237n).addMembership(23, ['aa', 'ff', 'zz'])
        )
        .addForVerifiableCredentials([{ index: 1338n, subindex: 0n }], (b) =>
            b.addRange(0, 80n, 1237n).addNonMembership(1, ['aa', 'ff', 'zz'])
        )
        .addForIdentityCredentials([0, 1, 2], (b) => b.revealAttribute(0))
        .getStatements();
    expect(statement).toStrictEqual(expectedStatementV2.statements);
});

const expectedStatementV2: { challenge: string; statements: IdStatementV2 } = {
    challenge:
        '44803def478a9a554f39eb8ae24f75ba9905f90a337c69743379c08c9a26cec0',
    statements: [
        {
            id: {
                type: 'sci',
                issuers: [
                    { index: 2101n, subindex: 0n },
                    { index: 1337n, subindex: 42n },
                ],
            },
            statement: [
                {
                    attributeTag: 17,
                    lower: 80n,
                    type: 'AttributeInRange',
                    upper: 1237n,
                },
                {
                    attributeTag: 23,
                    set: ['aa', 'ff', 'zz'],
                    type: 'AttributeInSet',
                },
            ],
        },
        {
            id: {
                type: 'sci',
                issuers: [{ index: 1338n, subindex: 0n }],
            },
            statement: [
                {
                    attributeTag: 0,
                    lower: 80n,
                    type: 'AttributeInRange',
                    upper: 1237n,
                },
                {
                    attributeTag: 1,
                    set: ['aa', 'ff', 'zz'],
                    type: 'AttributeNotInSet',
                },
            ],
        },
        {
            id: {
                type: 'cred',
                issuers: [0, 1, 2],
            },
            statement: [
                {
                    attributeTag: 0,
                    type: 'RevealAttribute',
                },
            ],
        },
    ],
};
