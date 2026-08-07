using FGP.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace FGP.Api.Data.Seed;

public static class DemoSpatialDataSeeder
{
    private static readonly DateTimeOffset SeedTimestamp = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static async Task SeedAsync(FgpDbContext database, CancellationToken cancellationToken = default)
    {
        var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(4326);
        database.Amenities.RemoveRange(await database.Amenities.Where(item => item.Source == "demo").ToListAsync(cancellationToken));
        database.DolomiteZones.RemoveRange(await database.DolomiteZones.Where(item => item.CgsReference != null && item.CgsReference.StartsWith("DEMO-")).ToListAsync(cancellationToken));
        database.ZoningDesignations.RemoveRange(await database.ZoningDesignations.Where(item => item.SourceUrl == "demo").ToListAsync(cancellationToken));
        database.Parcels.RemoveRange(await database.Parcels.Where(item => item.ErfNumber.StartsWith("DEMO ERF")).ToListAsync(cancellationToken));
        await database.SaveChangesAsync(cancellationToken);

        AddParcel(database, geometryFactory, "DEMO ERF 14201", "Soshanguve South Ext 13", "tshwane", 1024, 28.085, -25.54);
        AddParcel(database, geometryFactory, "DEMO ERF 2087", "Noordwyk Ext 19", "johannesburg", 980, 28.13, -25.976);
        AddParcel(database, geometryFactory, "DEMO ERF 551", "Clayville Ext 45", "ekurhuleni", 1500, 28.21, -25.94);
        AddZoning(database, geometryFactory, "tshwane", "RES3", 28.085, -25.54, 2016);
        AddZoning(database, geometryFactory, "johannesburg", "RES3", 28.13, -25.976, 2018);
        AddZoning(database, geometryFactory, "ekurhuleni", "RES2", 28.21, -25.94, 2014);
        AddDolomite(database, geometryFactory, "DEMO-CGS-TSH-001", "HIGH", 28.1, -25.525);
        AddDolomite(database, geometryFactory, "DEMO-CGS-JHB-002", "LOW", 28.13, -25.976);
        AddAmenity(database, geometryFactory, "Demo Soshanguve Secondary School", "school", 28.087, -25.538);
        AddAmenity(database, geometryFactory, "Demo Kgabo Village Mall", "mall", 28.0905, -25.5421);
        AddAmenity(database, geometryFactory, "Demo Soshanguve Taxi Rank", "taxi_rank", 28.0838, -25.5411);
        AddAmenity(database, geometryFactory, "Demo Noordwyk Primary School", "school", 28.1278, -25.9742);
        AddAmenity(database, geometryFactory, "Demo Midrand Gautrain Station", "gautrain", 28.138, -25.987);
        await database.SaveChangesAsync(cancellationToken);
    }

    private static void AddParcel(FgpDbContext database, GeometryFactory factory, string erf, string township, string municipality, decimal size, double lng, double lat)
    {
        var boundary = factory.CreatePolygon([new Coordinate(lng - .0005, lat - .0005), new Coordinate(lng + .0005, lat - .0005), new Coordinate(lng + .0005, lat + .0005), new Coordinate(lng - .0005, lat + .0005), new Coordinate(lng - .0005, lat - .0005)]);
        database.Parcels.Add(new Parcel { ErfNumber = erf, Township = township, Municipality = municipality, SizeSqm = size, Boundary = boundary, Centroid = factory.CreatePoint(new Coordinate(lng, lat)), CreatedAt = SeedTimestamp, UpdatedAt = SeedTimestamp });
    }

    private static void AddZoning(FgpDbContext database, GeometryFactory factory, string municipality, string code, double lng, double lat, int year) => database.ZoningDesignations.Add(new ZoningDesignation { Municipality = municipality, ZoneCode = code, ZoneLabel = code.StartsWith("RES", StringComparison.Ordinal) ? $"Residential {code[3..]}" : code, Geometry = factory.CreateMultiPolygon([factory.CreatePolygon([new Coordinate(lng - .003, lat - .003), new Coordinate(lng + .003, lat - .003), new Coordinate(lng + .003, lat + .003), new Coordinate(lng - .003, lat + .003), new Coordinate(lng - .003, lat - .003)])]), SchemeYear = year, SourceUrl = "demo", LastUpdated = new DateOnly(2026, 1, 1) });
    private static void AddDolomite(FgpDbContext database, GeometryFactory factory, string reference, string risk, double lng, double lat) => database.DolomiteZones.Add(new DolomiteZone { RiskClass = risk, CgsReference = reference, Geometry = factory.CreateMultiPolygon([factory.CreatePolygon([new Coordinate(lng - .1, lat - .075), new Coordinate(lng + .1, lat - .075), new Coordinate(lng + .1, lat + .075), new Coordinate(lng - .1, lat + .075), new Coordinate(lng - .1, lat - .075)])]) });
    private static void AddAmenity(FgpDbContext database, GeometryFactory factory, string name, string type, double lng, double lat) => database.Amenities.Add(new Amenity { Name = name, Type = type, Geometry = factory.CreatePoint(new Coordinate(lng, lat)), Source = "demo" });
}
