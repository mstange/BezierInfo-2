var React = require("react");
var BSplineGraphic = require("../../BSplineGraphic.jsx");
var SectionHeader = require("../../SectionHeader.jsx");
var KnotController = require("../../KnotController.jsx");
var WeightController = require("../../WeightController.jsx");

var BoundingBox = React.createClass({
  getDefaultProps: function() {
    return {
      title: "B-Splines"
    };
  },

  bindKnots: function(owner, knots, ref) {
    console.log(`binding knots for ${ref}`);
    this.refs[ref].bindKnots(owner, knots);
  },

  bindWeights: function(owner, weights, closed, ref) {
    this.refs[ref].bindWeights(owner, weights, closed);
  },

  render: function() {
    return (
      <section>
        <SectionHeader {...this.props} />

        <p>No discussion on Bézier curves is complete without also giving mention of that other
        beast in the curve design space: B-Splines. Easily confused to mean Bézier splines, that's
        not actually what they are; they are "basis function" splines, which makes a lot of difference,
        which we'll be looking at in this section. We're not going to dive as deep into B-Splines as
        we have for Bézier curves (that would be an entire primer on its own) but we'll be looking at
        how B-Splines work, what kind of maths is involved in computing them, and how to draw them
        based on a number of parameters that you can pick for individual B-Splines.</p>

        <p>First off: B-Splines are <a href="https://en.wikipedia.org/wiki/Piecewise">"piecewise polynomial interpolation curves"</a>, where the "single curve"
        is built by performing polynomial interpolation over a set of points, using a sliding window
        of a fixed number of points. For instance, a "cubic" B-Spline defined by twelve points will
        have its curve built by evaluating the polynomial interpolation of four points, and the curve
        can be treated as a lot of different sections, each controlled by four points at a time, such
        that the full curve consists of smoothly connected sections defined by points {1,2,3,4}, {2,3,4,5},
        ..., {8,9,10,11}, and finally {9,10,11,12}, for eight sections.</p>

        <p>What do they look like? They look like this! .. okay that's an empty graph, but simply
        click to place some point, with the stipulation that you need at least four point to see
        any curve. More than four points simply draws a longer B-Spline curve:</p>

        <BSplineGraphic sketch={require('./basic-sketch')} />

        <p>The important part to notice here is that we are <strong>not</strong> doing the same thing
        with B-Splines that we do for poly-Béziers or Catmull-Rom curves: both of the latter simply
        define new sections as literally "new sections based on new points", so a 12 point cubic
        poly-Bézier curve is actually impossible, because we start with a four point curve, and then
        add three more points for each section that follows, so we can only have 4, 7, 10, 13, 16, etc
        point Poly-Béziers. Similarly, while Catmull-Rom curves can grow by adding single points, this
        addition of a single point introduces three implicit Bézier points. Cubic B-Splines, on the other
        hand, are smooth interpolations of <em>each possible curve involving four consecutive points</em>,
        such that at any point along the curve except for our start and end points, our on-curve
        coordinate is defined by four control points.</p>

        <p>Consider the difference to be this:</p>

        <ul>
          <li>for Bézier curves, the curve is defined as an interpolation of points, but:</li>
          <li>for B-Splines, the curve is defined as an interpolation of <em>curves</em>.</li>
        </ul>

        <p>In order to make this interpolation of curves work, the maths is necessarily more complex
        than the maths for Bézier curves, so let's have a look at how things work.</p>

        <h2>
          How to compute a B-Spline curve: some maths
        </h2>

        <p>
          Given a B-Spline of degree <code>d</code> and thus order <code>k=d+1</code> (so a quadratic
          B-Spline is degree 2 and order 3, a cubic B-Spline is degree 3 and order 4, etc) and <code>n</code> control
          points <code>P<sub>0</sub></code> through <code>P<sub>n-1</sub></code>, we can compute a
          point on the curve for some value <code>t</code> in the interval [0,1] (where 0 is the start
          of the curve, and 1 the end, just like for Bézier curves), by evaluting the following function:
        </p>

        <p>\[
          Point(t) = \sum^n_{i=0} P_i \cdot N_{i,k}(t)
        \]</p>

        <p>
          Which, honestly, doesn't tell us all that much. All we can see is that a point on a B-Spline curve
          is defined as "a mix of all the control points, weighted somehow", where the weighting is achieved
          through the <em>N(...)</em> function, subscipted with an obvious parameter <code>i</code>, which
          comes from our summation, and some magical parameter <code>k</code>. So we need to know two things:
          1. what does N(t) do, and 2. what is that <code>k</code>? Let's cover both, in reverse order.
        </p>

        <p>The parameter <code>k</code> represents the "knot interval" over which a section of curve is defined.
        As we learned earlier, a B-Spline curve is itself an interpoliation of curves, and we can treat each
        transition where a control point starts or tops influencing the total curvature as a "knot on the curve".
        Doing so for a degree <code>d</code> B-Spline with <code>n</code> control point gives us <code>d + n +
        1</code> knots, defining <code>d + n</code> intervals along the curve, and it is these intervals that
        the above <code>k</code> subscript to the N() function applies to.</p>

        <p>Then the N() function itself. What does it look like?</p>

        <p>\[
          N_{i,k}(t) = \left ( \frac{t-knot_i}{knot_{(i+k-1)} - knot_i}\right ) \cdot N_{i,k-1}(t) + \left ( \frac{knot_{(i+k)}-t}{knot_{(i+k)} - knot_{(i+1)}} \right ) \cdot N_{i+1,k-1}(t)
          \]</p>

        <p>
          So this is where we see the interpolation: N(t) for an (i,k) pair (that is, for a step in the above summation,
          on a specific knot interval) is a mix between N(t) for (i,k-1) and N(t) for (i+1,k-1), so we see that this is
          a recursive iteration where <code>i</code> goes up, and <code>k</code> goes down, so it seem reasonable to
          expect that this recursion has to stop at some point; obviously, it does, and specifically it does so for
          the following <code>i</code>/<code>k</code> values:
        </p>

        <p>\[
          N_{i,1}(t) = \left\{\begin{matrix}
                       1& \text{if } t \in [knot_i,knot_{i+1}) \\
                       0& \text{otherwise}
                       \end{matrix}\right.
        \]</p>

        <p>
          And this function finally has a straight up evaluation: if a <code>t</code> value lies within a knot-specific
          interval once we reach a <code>k=1</code> value, it "counts", otherwise it doesn't. We did cheat a little, though,
          because for all these values we need to scale our <code>t</code> value first, so that it lies in the interval
          bounded by <code>knots[d]</code> and <code>knots[n]</code>, which are the start point and end point where curvature
          is controlled by exactly <code>order</code> control points. For instance, for degree 3 (=order 4) and 7 control points,
          with knot vector [1,2,3,4,5,6,7,8,9,10,11], we map <code>t</code> from [the interval 0,1] to the interval [4,8],
          and then use that value in the functions above, instead.
        </p>

        <h2>
          Can we simplify that?
        </h2>

        <p>
          We can, yes.
        </p>

        <p>
          People far smarter than us have looked at this work, and two in particular —<a href="http://www.npl.co.uk/people/maurice-cox">Maurice Cox</a> and <a href="https://en.wikipedia.org/wiki/Carl_R._de_Boor">Carl de Boor</a>— came
          to a mathematically pleasing solution: to compute a point P(t), we can compute this point by
          evaluating <em>d(t)</em> on a curve section between knots <em>i</em> and <em>i+1</em>:
        </p>

        <p>\[
          d^k_i(t) = \alpha_{i,k} \cdot d^{k-1}_i(t) + (1-\alpha_{i,k}) \cdot d^{k-1}_{i-1}(t)
        \]</p>

        This is another recursive function, with <em>k</em> values decreasing from the curve order to 1,
        and the value <em>α</em> (alpha) defined by:

        <p>\[
          \alpha_{i,k} = \frac{t - knots[i]}{knots[i+1+n-k] - knots[i]}
        \]</p>

        <p>
          That looks complicated, but it's not. Computing alpha is just a fraction involving known, plain numbers
          and once we have our alpha value, computing (1-alpha) is literally just "computing one minus alpha".
          Computing this d() function is thus simply a matter of "computing simple arithmetics
          but with recursion", which might be computationally expensive because we're doing "a lot of" steps, but
          is also computationally cheap because each step only involves very simple maths. Of course as before
          the recursion has to stop:
        </p>

        <p>\[
          d^k_0(t) = 0, \ d^0_i(t) = N_{i,1}(t) =
          \left\{\begin{matrix}
            1& \text{if } t \in [knot_i,knot_{i+1}) \\
            0& \text{otherwise}
          \end{matrix}\right.
        \]</p>

        <p>
          So, we see two stopping conditions: either <code>i</code> becomes 0, in which case d() is zero,
          or <code>k</code> becomes zero, in which case we get the same "either 1 or 0" that we saw in the N()
          function above.</p>

        <p>
          Thanks to Cox and de Boor, we can compute points on a B-Spline pretty easily: we just need to compute
          a triangle of interconnected values. For instance, d() for i=3, k=3 yields the following triangle:
        </p>

        <p>\[\begin{array}{ccccccc}
          d^3_3 &→& d^2_3 &→& d^1_3 &→& d^0_3 (= 0 \text{ or } 1) \\
          &+^{α^3_3 \times …}_{(1-{α^3_3}) \times …}&       &+^{α^2_3 \times …}_{(1-{α^2_3}) \times …}& &+^{α^1_3 \times …}_{(1-{α^1_3}) \times …}&\\
          &↘&       &↘&       &↘& \\
          & & d^2_2 &→& d^1_2 &→& d^0_2 (= 0 \text{ or } 1) \\
          & &       &+^{α^2_2 \times …}_{(1-{α^2_2}) \times …}&  &+^{α^1_2 \times …}_{(1-{α^1_2}) \times …}&\\
          & &       &↘&        &↘& \\
          & &       & &  d^1_1 &→&  d^0_1 (= 0 \text{ or } 1) \\
          & &       & &        &+^{α^1_1 \times …}_{(1-{α^1_1}) \times …}&\\
          & &       & &        &↘& \\
          & &       & &        & &  d^0_0 (= 0)
          \end{array}\]</p>

        <p>
          That is, we compute d(3,3) as a mixture of d(2,3) and d(2,2): d(3,3) = a(3,3) x d(2,3) + (1-a(3,3)) x d(2,2)... and
          we simply keep expanding our triangle until we reach the terminating function parameters. Done deal!
        </p>

        <p>
          One thing we need to keep in mind is that we're working with a spline that is contrained by its control points,
          so even though the <code>d(..., k)</code> values are zero or one at the lowest level, they are really "zero or one, times their
          respective control point", so in the next section you'll see the algorithm for running through the computation in
          a way that starts with a copy of the control point vector and then works its way up to that single point:
          that's pretty essential!
        </p>

        <p>
          If we run this computation "down", starting at d(3,3), then without special code in place we would be computing quite a
          few terms multiple times at each step. On the other hand, we can also start with that last "column", we can generate
          the terminating d() values first, then compute the a() constants, perform our multiplcations, generate the previous
          step's d() values, compute their a() constants, do the multiplications, etc. until we end up all the way back at the
          top. If we run our computation this way, we don't need any explicit caching, we can just "recycle" the list of numbers
          we start with and simply update them as we move up the triangle. So, let's implement that!
        </p>

        <h2>
          Cool, cool... but I don't know what to do with that information
        </h2>

        <p>I know, this is pretty mathy, so let's have a look at what happens when we change parameters here. We can't change
        the maths for the interpolation functions, so that gives us only one way to control what happens here: the knot vector
        itself. As such, let's look at the graph that shows the interpolation functions for a cubic B-Spline with seven points
        with a uniform knot vector (so we see seven identical functions), representing how much each point (represented by
        one function each) influences the total curvature, given our knot values. And, because exploration is the key to
        discovery, let's make the knot vector a thing we can actually manipulate. Normally a proper knot vector has a constraint
        that any value is strictly equal to, or larger than the previous ones, but screw it this is programming, let's
        ignore that hard restriction and just mess with the knots however we like.</p>

        <div className="two-column">
          <KnotController ref="interpolation-graph" />
          <BSplineGraphic sketch={require('./interpolation-graph')} controller={(owner, knots) => this.bindKnots(owner, knots, "interpolation-graph")}/>
        </div>

        <p>Changing the values in the knot vector changes how much each point influences the total curvature
        (with some clever knot value manipulation, we can even make the influence of certain points disappear
        entirely!), so we can see that while the control points define the hull inside of which we're going
        to be drawing a curve, it is actually the knot vector that determines the actual <em>shape</em> of
        the curve inside that hull.</p>

        <p>After reading the rest of this section you may want to come back here to try some specific knot vectors,
        and see if the resulting interpolation landscape makes sense given what you will now think should happen!</p>

        <h2>
          Running the computation
        </h2>

        <p>
          Unlike the de Casteljau algorithm, where the <code>t</code> value stays the same at every iteration, for B-Splines that
          is not the case, and so we end having to (for each point we evaluate) run a fairly involving bit of recursive computation.
          The algorithm is discussed on <a href="http://www.cs.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/de-Boor.html">this Michigan
          Tech</a> page, but an easier to read version is implemented
          by <a href="https://github.com/thibauts/b-spline/blob/master/index.js#L59-L71">b-spline.js</a>, so we'll look at its code.
        </p>

        <p>
          Given an input value <code>t</code>, we first map the input to a value from the domain [0,1] to the domain [knots[degree],
          knots[knots.length - 1 - degree]. Then, we find the section number <code>s</code> that this mapped <code>t</code> value lies on:
        </p>

        <pre>
        for(s=domain[0]; s < domain[1]; s++) {
          if(knots[s] <= t && t <= knots[s+1]) break;
        }</pre>

        <p>
          after running this code, <code>s</code> is the index for the section the point will lie on. We then run the algorithm mentioned on the MU page (updated to use this description's variable names):
        </p>

        <pre>
        let v = copy of control points

        for(let L = 1; L <= order; L++) {
          for(let i=s; i > s + L - order; i--) {
            let numerator = t - knots[i]
            let denominator = knots[i - L + order] - knots[i]
            let alpha = numerator / denominator
            let v[i] = alpha * v[i] + (1-alpha) * v[i-1]
          }
        }</pre>

        <p>
          (A nice bit of behaviour in this code is that we work the interpolation "backwards", starting at <code>i=s</code> at
          each level of the interpolation, and we stop when <code>i = s - order + level</code>, so we always end up with a
          value for <code>i</code> such that those <code>v[i-1]</code> don't try to use an array index that doesn't exist)
        </p>

        <h2>
          Open vs. closed paths
        </h2>

        <p>
          Much like poly-Béziers, B-Splines can be either open, running from the first point to the last point, or closed,
          where the first and last point are <em>the same point</em>. However, because B-Splines are an interpolation of
          curves, not just point, we can't simply make the first and last point the same, we need to link a few point point:
          for an order <code>d</code> B-Spline, we need to make the last <code>d</code> point the same as the first <code>d</code> points.
          And the easiest way to do this is to simply append <code>points.splice(0,d)</code> to <code>points</code>. Done!
        </p>

        <p>
          Of course if we want to manipulate these kind of curves we need to make sure to mark them as "closed" so that
          we know the coordinate for <code>points[0]</code> and <code>points[n-k]</code> etc. are the same coordinate,
          and manipulating one will equally manipulate the other, but programming generally makes this really easy by
          storing references to coordinates (or other linked values such as coordinate weights, discussed in the NURBS
          section) rather than separate coordinate objects.
        </p>

        <h2>
          Manipulating the curve through the knot vector
        </h2>

        <p>
          The most important thing to understand when it comes to B-Splines is that they work <em>because</em> of the concept
          of a knot vector. As mentioned above, knots represent "where individual control points start/stop influencing
          the curve", but we never looked at the <em>values</em> that go in the knot vector. If you look back at the N() and
          a() functions, you see that interpolations are based on intervals in the knot vector, rather than the actual values
          in the knot vector, and we can exploit this to do some pretty interesting things with clever manipulation of the
          knot vector. Specifically there are four things we can do that are worth looking at:
        </p>

        <ol>
          <li>we can use a uniform knot vector, with equally spaced intervals,</li>
          <li>we can use a non-uniform knot vector, without enforcing equally spaced internvals,</li>
          <li>we can collapse sequential knots to the same value, locally lowering curve complexity using "null" intervals, and</li>
          <li>we can form a special case non-uniform vector, by combining (1) and (3) to for a vector with collapsed start and end knots, with a uniform vector in between.</li>
        </ol>

        <h3>Uniform B-Splines</h3>

        <p>
          The most straightforward type of B-Spline is the uniform spline. In a uniform spline, the knots are distributed
          uniformly over the entire curve interval. For instance, if we have a knot vector of length twelve, then a uniform
          knot vector would be [0,1,2,3,...,9,10,11]. Or [4,5,6,...,13,14,15], which defines <em>the same intervals</em>,
          or even [0,2,3,...,18,20,22], which also defines <em>the same intervals</em>, just scaled by a constant factor,
          which becomes normalised during interpolation and so does not contribute to the curvature.
        </p>

        <div className="two-column">
          <KnotController ref="uniform-spline" />
          <BSplineGraphic sketch={require('./uniform-bspline')} controller={(owner, knots) => this.bindKnots(owner, knots, "uniform-spline")}/>
        </div>

        <p>
          This is an important point: the intervals that the knot vector defines are <em>relative</em> intervals, so it
          doesn't matter if every interval is size 1, or size 100 - the relative differences between the intervals is what
          shapes any particular curve.
        </p>

        <p>
          The problem with uniform knot vectors is that, as we need <code>order</code> control points before we have any
          curve with which we can perform interpolation, the curve does not "start" at the first point, nor "ends" at
          the last point. Instead there are "gaps". We can get rid of these, by being clever about how we apply
          the following uniformity-breaking approach instead...
        </p>

        <h3>Reducing local curve complexity by collapsing intervals</h3>

        <p>
          By collapsing knot intervals by making two or more consecutive knots have the same value, we can reduce the
          curve complexity in the sections that are affected by the knots involved. This can have drastic effects:
          for ever interval collapse, the curve order goes down, and curve continuity goes down, to the point where
          collapsing <code>order</code> knots creates a situation where all continuity is lost and the curve "kinks".
        </p>

        <div className="two-column">
          <KnotController ref="center-cut-bspline" />
          <BSplineGraphic sketch={require('./center-cut-bspline')} controller={(owner, knots) => this.bindKnots(owner, knots, "center-cut-bspline")}/>
        </div>

        <h3>Open-Uniform B-Splines</h3>

        <p>
          By combining knot interval collapsing at the start and end of the curve, with uniform knots in between, we
          can overcome the problem of the curve not starting and ending where we'd kind of like it to:
        </p>

        <p>
          For any curve of degree <code>D</code> with control points <code>N</code>, we can define a knot vector of
          length <code>N+D+1</code> in which the values <code>0 ... D+1</code> are the same, the values <code>D+1 ... N+1</code> follow
          the "uniform" pattern, and the values <code>N+1 ... N+D+1</code> are the same again. For example, a
          cubic B-Spline with 7 control points can have a knot vector [0,0,0,0,1,2,3,4,4,4,4], or it might have the
          "identical" knot vector [0,0,0,0,2,4,6,8,8,8,8], etc. Again, it is the relative differences that determine the curve shape.
        </p>

        <div className="two-column">
          <KnotController ref="open-uniform-bspline" />
          <BSplineGraphic sketch={require('./open-uniform-bspline')} controller={(owner, knots) => this.bindKnots(owner, knots, "open-uniform-bspline")}/>
        </div>

        <h3>Non-uniform B-Splines</h3>

        <p>This is essentialy the "free form" version of a B-Spline, and also the least interesting to look at,
        as without any specific reason to pick specific knot intervals, there is nothing particularly interesting
        going on. There is one constraint to the knot vector, and that is that any value <code>knots[k+1]</code>
        should be equal to, or greater than <code>knots[k]</code>.</p>

        <h2>One last thing: Rational B-Splines</h2>

        <p>While it is true that this section on B-Splines is running quite long already, there is one more thing
        we need to talk about, and that's "Rational" splines, where the rationality applies to the "ratio", or relative
        weights, of the control points themselves. By introducing a ratio vector with weights to apply to each
        control point, we greatly increase our influence over the final curve shape: the more weight a control
        point carries, the close to that point the spline curve will lie, a bit like turning up the gravity
        of a control point.</p>

        <div className="two-column">
          {
            // <KnotController ref="rational-uniform-bspline" />
          }
          <WeightController ref="rational-uniform-bspline-weights" />
          <BSplineGraphic scrolling={true} sketch={require('./rational-uniform-bspline')} controller={(owner, knots, weights, closed) => {
            // this.bindKnots(owner, knots, "rational-uniform-bspline");
            this.bindWeights(owner, weights, closed, "rational-uniform-bspline-weights");
          }} />
        </div>

        <p>Of course this brings us to the final topic that any text on B-Splines must touch on before calling it
        a day: the NURBS, or Non-Uniform Rational B-Spline (NURBS is not a plural, the capital S actually just stands
        for "spline", but a lot of people mistakenly treat it as if it is, so now you know better). NURBS are an
        important type of curve in computer-facilitated design, used a lot in 3D modelling (as NURBS surfaces)
        as well as in arbitrary-precision 2D design due to the level of control a NURBS curve offers designers.
        </p>

        <p>While a true non-uniform rational B-Spline would be hard to work with, when we talk about NURBS we
        typically mean the Open-Uniform Rational B-Spline, or OURBS, but that doesn't roll off the tongue nearly
        as nicely, and so remember that when people talk about NURBS, they typically mean open-uniform, which
        has the useful property of starting the curve at the first control point, and ending it at the last.</p>

        <h2>Extending our implementation to cover rational splines</h2>

        <p>
          The algorithm for working with Rational B-Splines is virtually identical to the regular algorithm, and
          the extension to work in the control point weights is fairly simple:
          we extend each control point from a point in its original number of dimensions (2D, 3D, etc) to one
          dimension higher, scaling the original dimensions by the control point's weight, and then
          assigning that weight as its value for the extended dimension.
        </p>

        <p>
          For example, a 2D point <code>(x,y)</code> with weight <code>w</code> becomes
          a 3D point <code>(w * x, w * y, w)</code>.
        </p>

        <p>
          We then run the same algorithm as before, which will automaticall perform weight interpolation in
          addition to regular coordinate interpolation, because all we've done is pretended we have coordinates
          in a higher dimension. The algorithm doesn't really care about how many dimensions it needs to interpolate.
        </p>

        <p>
          In order to recover our "real" curve point, we take the final result of the point generation algorithm,
          and "unweigh" it: we take the final point's derived weight <code>w'</code> and divide all the regular
          coordinate dimensions by it, then throw away the weight information.
        </p>

        <p>
          Based on our previous example, we take the final 3D point <code>(x', y', w')</code>, which we then
          turn back into a 2D point by computing <code>(x'/w', y'/w')</code>. And that's it, we're done!
        </p>

      </section>
    );
  }
});

module.exports = BoundingBox;
